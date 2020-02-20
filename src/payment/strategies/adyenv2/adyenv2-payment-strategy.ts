import { some } from 'lodash';

import { CheckoutStore, InternalCheckoutSelectors } from '../../../checkout';
import { getBrowserInfo } from '../../../common/browser-info';
import { InvalidArgumentError, MissingDataError, MissingDataErrorType, NotInitializedError, NotInitializedErrorType, RequestError } from '../../../common/error/errors';
import { OrderActionCreator, OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { PaymentArgumentInvalidError } from '../../errors';
import isVaultedInstrument from '../../is-vaulted-instrument';
import Payment, { HostedInstrument } from '../../payment';
import PaymentActionCreator from '../../payment-action-creator';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import PaymentStrategy from '../payment-strategy';

import { ActionType, AdditionalAction, AdditionalActionState, AdyenAction, AdyenCheckout, AdyenComponent, AdyenConfiguration, AdyenError, ComponentState, ComponentType } from './adyenv2';
import AdyenV2PaymentInitializeOptions from './adyenv2-initialize-options';
import AdyenV2ScriptLoader from './adyenv2-script-loader';

export default class AdyenV2PaymentStrategy implements PaymentStrategy {
    private _adyenCheckout?: AdyenCheckout;
    private _adyenv2?: AdyenV2PaymentInitializeOptions;
    private _adyenPaymentComponent?: AdyenComponent;
    private _adyenCardVerificationComponent?: AdyenComponent;
    private _componentState?: ComponentState;

    constructor(
        private _store: CheckoutStore,
        private _paymentActionCreator: PaymentActionCreator,
        private _orderActionCreator: OrderActionCreator,
        private _adyenV2ScriptLoader: AdyenV2ScriptLoader,
        private _locale: string
    ) {}

    initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        const { adyenv2 } = options;

        if (!adyenv2) {
            throw new InvalidArgumentError('Unable to initialize payment because "options.adyenv2" argument is not provided.');
        }

        const paymentMethod = this._store.getState().paymentMethods.getPaymentMethod(options.methodId);

        if (!paymentMethod) {
            throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
        }

        this._adyenv2 = adyenv2;

        const configuration: AdyenConfiguration = {
            environment:  paymentMethod.initializationData.environment,
            locale: this._locale,
            originKey: paymentMethod.initializationData.originKey,
            paymentMethodsResponse: paymentMethod.initializationData.paymentMethodsResponse,
        };

        return this._adyenV2ScriptLoader.load(configuration)
            .then(adyenCheckout => {
                this._adyenCheckout = adyenCheckout;

                const paymentComponent = this._adyenCheckout.create(
                    paymentMethod.method,
                    {
                        ...adyenv2.options,
                        onChange: (componentState: ComponentState) => {
                            this._updateComponentState(componentState);
                        },
                    }
                );

                paymentComponent.mount(`#${adyenv2.containerId}`);

                this._adyenPaymentComponent = paymentComponent;

                if (adyenv2.cardVerificationContainerId) {
                    const cardVerificationComponent = this._adyenCheckout.create(ComponentType.SecuredFields, {
                        onChange: (componentState: ComponentState) => {
                            this._updateComponentState(componentState);
                        },
                    });

                    cardVerificationComponent.mount(`#${adyenv2.cardVerificationContainerId}`);

                    this._adyenCardVerificationComponent = cardVerificationComponent;
                }

                return Promise.resolve(this._store.getState());
            });
    }

    execute(payload: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        const { payment, ...order } = payload;
        const paymentData = payment && payment.paymentData;
        const shouldSaveInstrument = paymentData && (paymentData as HostedInstrument).shouldSaveInstrument;

        if (!payment) {
            throw new PaymentArgumentInvalidError(['payment']);
        }

        return this._store.dispatch(this._orderActionCreator.submitOrder(order, options))
            .then(() => {
                const componentState = this._componentState;

                if (!componentState) {
                    throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
                }
                if (paymentData && isVaultedInstrument(paymentData)) {

                    const { encryptedCardNumber, encryptedSecurityCode } = componentState.data.paymentMethod;

                    return this._store.dispatch(this._paymentActionCreator.submitPayment({
                        ...payment,
                        paymentData: {
                            formattedPayload: {
                                bigpay_token: {
                                    credit_card_number_confirmation: encryptedCardNumber,
                                    token: paymentData.instrumentId,
                                    verification_value: encryptedSecurityCode,
                                },
                                browser_info: getBrowserInfo(),
                            },
                        },
                    }));
                }

                const paymentPayload = {
                    methodId: payment.methodId,
                    paymentData: {
                        formattedPayload: {
                            credit_card_token: {
                                token: JSON.stringify({
                                    ...componentState.data.paymentMethod,
                                    origin: window.location.origin,
                                }),
                            },
                            browser_info: getBrowserInfo(),
                            vault_payment_instrument: shouldSaveInstrument,
                        },
                    },
                };

                return this._store.dispatch(this._paymentActionCreator.submitPayment(paymentPayload));
            })
            .catch(error => {
                if (!(error instanceof RequestError) || !some(error.body.errors, { code: 'additional_action_required' })) {
                    return Promise.reject(error);
                }

                return this._handleFromAction(error.body.provider_data)
                    .then((payment: Payment) =>
                        this._store.dispatch(this._paymentActionCreator.submitPayment({
                            ...payment,
                            paymentData: {
                                ...payment.paymentData,
                                shouldSaveInstrument,
                            },
                        }))
                    )
                    .catch(error => {
                        if (!(error instanceof RequestError) || !some(error.body.errors, { code: 'additional_action_required' })) {
                            return Promise.reject(error);
                        }

                        return this._handleFromAction(error.body.provider_data)
                            .then((payment: Payment) =>
                                this._store.dispatch(this._paymentActionCreator.submitPayment({
                                    ...payment,
                                    paymentData: {
                                        ...payment.paymentData,
                                        shouldSaveInstrument,
                                    },
                                }))
                            );
                        }
                    );
            });
    }

    finalize(): Promise<InternalCheckoutSelectors> {
        return Promise.reject(new OrderFinalizationNotRequiredError());
    }

    deinitialize(): Promise<InternalCheckoutSelectors> {
        if (this._adyenPaymentComponent) {
            this._adyenPaymentComponent.unmount();
            this._adyenPaymentComponent = undefined;
        }

        if (this._adyenCardVerificationComponent) {
            this._adyenCardVerificationComponent.unmount();
            this._adyenCardVerificationComponent = undefined;
        }

        return Promise.resolve(this._store.getState());
    }

    private _getAdyenV2PaymentInitializeOptions(): AdyenV2PaymentInitializeOptions {
        if (!this._adyenv2) {
            throw new InvalidArgumentError('"options.adyenv2" argument was not provided during initialization.');
        }

        return this._adyenv2;
    }

    private _getThreeDS2ChallengeWidgetSize(): string {
        const { widgetSize } = this._getAdyenV2PaymentInitializeOptions().threeDS2Options;

        if (!widgetSize) {
            return '05';
        }

        return widgetSize;
    }

    private _handleFromAction(additionalAction: AdditionalAction): Promise<Payment> {
        return new Promise((resolve, reject) => {
            if (!this._adyenCheckout) {
                throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
            }

            const { threeDS2ContainerId, additionalActionOptions } = this._getAdyenV2PaymentInitializeOptions();
            const { onBeforeLoad, containerId, onLoad, onComplete } = additionalActionOptions;
            const adyenAction: AdyenAction = JSON.parse(additionalAction.action);

            const additionalActionComponent = this._adyenCheckout.createFromAction(adyenAction, {
                onAdditionalDetails: (additionalActionState: AdditionalActionState) => {
                    const paymentPayload = {
                        methodId: adyenAction.paymentMethodType,
                        paymentData: {
                            nonce: JSON.stringify(additionalActionState.data),
                        },
                    };

                    if (onComplete) {
                        onComplete();
                    }

                    resolve(paymentPayload);
                },
                size: this._getThreeDS2ChallengeWidgetSize(),
                onError: (error: AdyenError) => reject(error),
            });

            if (onBeforeLoad) {
                onBeforeLoad(adyenAction.type === ActionType.ThreeDS2Challenge);
            }

            additionalActionComponent.mount(`#${containerId || threeDS2ContainerId}`);

            if (onLoad) {
                onLoad(() => {
                    reject();
                    additionalActionComponent.unmount();
                });
            }
        });
    }

    private _updateComponentState(componentState: ComponentState) {
        this._componentState = componentState;
    }
}
