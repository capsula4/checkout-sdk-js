import { createClient as createPaymentClient } from '@bigcommerce/bigpay-client';
import { createAction, createErrorAction } from '@bigcommerce/data-store';
import { createRequestSender } from '@bigcommerce/request-sender';
import { createScriptLoader, createStylesheetLoader } from '@bigcommerce/script-loader';
import { of, Observable } from 'rxjs';

import { createCheckoutStore, CheckoutRequestSender, CheckoutStore, CheckoutValidator } from '../../../checkout';
import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { InvalidArgumentError, MissingDataError, NotInitializedError, RequestError } from '../../../common/error/errors';
import { FinalizeOrderAction, OrderActionCreator, OrderActionType, OrderRequestSender, SubmitOrderAction } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { PaymentInitializeOptions } from '../../../payment';
import { PaymentArgumentInvalidError } from '../../errors';
import PaymentActionCreator from '../../payment-action-creator';
import { PaymentActionType, SubmitPaymentAction } from '../../payment-actions';
import { getAdyenV2 } from '../../payment-methods.mock';
import PaymentRequestSender from '../../payment-request-sender';
import PaymentRequestTransformer from '../../payment-request-transformer';

import { AdditionalActionState, AdyenError, AdyenV2PaymentStrategy, AdyenV2ScriptLoader, ComponentState, ResultCode } from '.';
import { AdyenCheckout, AdyenComponent } from './adyenv2';
import { getAdditionalActionError, getAdyenCheckout, getAdyenError, getInitializeOptions, getInitializeOptionsWithNoCallbacks, getInitializeOptionsWithUndefinedWidgetSize, getOrderRequestBody, getOrderRequestBodyWithoutPayment, getOrderRequestBodyWithVaultedInstrument, getUnknownError, getValidCardState } from './adyenv2.mock';

describe('AdyenV2PaymentStrategy', () => {
    let finalizeOrderAction: Observable<FinalizeOrderAction>;
    let adyenV2ScriptLoader: AdyenV2ScriptLoader;
    let orderActionCreator: OrderActionCreator;
    let paymentActionCreator: PaymentActionCreator;
    let store: CheckoutStore;
    let orderRequestSender: OrderRequestSender;
    let strategy: AdyenV2PaymentStrategy;
    let submitOrderAction: Observable<SubmitOrderAction>;
    let submitPaymentAction: Observable<SubmitPaymentAction>;

    beforeEach(() => {
        const scriptLoader = createScriptLoader();
        const stylesheetLoader = createStylesheetLoader();
        const requestSender = createRequestSender();
        orderRequestSender = new OrderRequestSender(requestSender);
        orderActionCreator = new OrderActionCreator(
            orderRequestSender,
            new CheckoutValidator(new CheckoutRequestSender(requestSender))
        );

        paymentActionCreator = new PaymentActionCreator(
            new PaymentRequestSender(createPaymentClient()),
            orderActionCreator,
            new PaymentRequestTransformer()
        );

        adyenV2ScriptLoader = new AdyenV2ScriptLoader(scriptLoader, stylesheetLoader);

        store = createCheckoutStore(getCheckoutStoreState());

        finalizeOrderAction = of(createAction(OrderActionType.FinalizeOrderRequested));
        submitOrderAction = of(createAction(OrderActionType.SubmitOrderRequested));
        submitPaymentAction = of(createAction(PaymentActionType.SubmitPaymentRequested));

        jest.spyOn(store, 'dispatch');

        jest.spyOn(orderActionCreator, 'finalizeOrder')
            .mockReturnValue(finalizeOrderAction);

        jest.spyOn(orderActionCreator, 'submitOrder')
            .mockReturnValue(submitOrderAction);

        jest.spyOn(paymentActionCreator, 'submitPayment')
            .mockReturnValue(submitPaymentAction);

        strategy = new AdyenV2PaymentStrategy(
            store,
            paymentActionCreator,
            orderActionCreator,
            adyenV2ScriptLoader,
            'en_US'
        );
    });

    describe('#initialize()', () => {
        let options: PaymentInitializeOptions;
        const adyenCheckout: AdyenCheckout = getAdyenCheckout();

        beforeEach(() => {
            options = getInitializeOptions();

            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(getAdyenV2());

            jest.spyOn(adyenV2ScriptLoader, 'load').mockReturnValue(Promise.resolve(adyenCheckout));
        });

        it('does not load adyen V2 if initialization options are not provided', () => {
            options.adyenv2 = undefined;

            expect(() => strategy.initialize(options))
                .toThrow(InvalidArgumentError);
        });

        it('does not load adyen V2 if paymentMethod is not provided', () => {
            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(undefined);

            expect(() => strategy.initialize(options))
                .toThrow(MissingDataError);
        });

        it('does not create adyen card verification component', async () => {
            if (options.adyenv2) {
                options.adyenv2.cardVerificationContainerId = undefined;
            }

            await strategy.initialize(options);

            expect(adyenCheckout.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('#execute', () => {
        const adyenCheckout: AdyenCheckout = getAdyenCheckout();
        const identifyShopperError = getAdditionalActionError(ResultCode.IdentifyShopper);
        const challengeShopperError = getAdditionalActionError(ResultCode.ChallengeShopper);
        let adyenPaymentComponent: AdyenComponent;
        let adyenCardVerificationComponent: AdyenComponent;
        let options: PaymentInitializeOptions;
        let additionalActionComponent: AdyenComponent;

        beforeEach(() => {
            let handleOnChange: (componentState: ComponentState) => {};
            let handleOnAdditionalDetails: (additionalActionState: AdditionalActionState) => {};

            options = getInitializeOptions();

            adyenPaymentComponent = {
                mount: jest.fn(() => {
                    handleOnChange(getValidCardState());

                    return;
                }),
                unmount: jest.fn(),
            };

            adyenCardVerificationComponent = {
                mount: jest.fn(() => {
                    handleOnChange(getValidCardState());

                    return;
                }),
                unmount: jest.fn(),
            };

            additionalActionComponent = {
                mount: jest.fn(() => {
                    handleOnAdditionalDetails({
                        data: {
                            resultCode: ResultCode.ChallengeShopper,
                            action: 'adyenAction',
                        },
                        isValid: true,
                    });

                    return;
                }),
                unmount: jest.fn(),
            };

            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(getAdyenV2());

            jest.spyOn(adyenV2ScriptLoader, 'load').mockReturnValue(Promise.resolve(adyenCheckout));

            jest.spyOn(adyenCheckout, 'create')
                .mockImplementationOnce(jest.fn((_method, options) => {
                    const { onChange } = options;
                    handleOnChange = onChange;

                    return adyenPaymentComponent;
                }))
                .mockImplementationOnce(jest.fn((_method, options) => {
                    const { onChange } = options;
                    handleOnChange = onChange;

                    return adyenCardVerificationComponent;
                }));

            jest.spyOn(adyenCheckout, 'createFromAction')
                .mockImplementation(jest.fn((_type, options) => {
                    const { onAdditionalDetails } = options;
                    handleOnAdditionalDetails = onAdditionalDetails;

                    return additionalActionComponent;
                }));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('throws an error when payment is not present', async () => {
            await strategy.initialize(options);

            try {
                await strategy.execute(getOrderRequestBodyWithoutPayment());
            } catch (error) {
                expect(error).toBeInstanceOf(PaymentArgumentInvalidError);
            }

            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
        });

        it('returns UNKNOWN_ERROR', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, getUnknownError())))
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);

            try {
                await strategy.execute(getOrderRequestBody());
            } catch (error) {
                expect(error).toBeInstanceOf(RequestError);
            }

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(1);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
        });

        it('tries to pay with invalid component state', async () => {
            const adyenInvalidPaymentComponent = {
                mount: jest.fn(),
                unmount: jest.fn(),
            };
            jest.spyOn(adyenCheckout, 'create')
                .mockReturnValue(adyenInvalidPaymentComponent);

            await strategy.initialize(options);

            try {
                await strategy.execute(getOrderRequestBody());
            } catch (error) {
                expect(error).toBeInstanceOf(NotInitializedError);
            }

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(0);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
        });

        it('pays with vaulted instrument', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);
            await strategy.execute(getOrderRequestBodyWithVaultedInstrument());

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(1);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
        });

        it('additional action component fires back onError', async () => {
            let additionalActionComponentWithError: AdyenComponent;
            let handleOnError: (error: AdyenError) => {};

            additionalActionComponentWithError = {
                mount: jest.fn(() => {
                    handleOnError(getAdyenError());

                    return;
                }),
                unmount: jest.fn(),
            };

            jest.spyOn(adyenCheckout, 'createFromAction')
                .mockImplementation(jest.fn((_type, options) => {
                    const { onError } = options;
                    handleOnError = onError;

                    return additionalActionComponentWithError;
                }));
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, identifyShopperError)));

            await strategy.initialize(options);

            try {
                await strategy.execute(getOrderRequestBody());
            } catch (error) {
                expect(error.errorCode).toEqual('CODE');
                expect(error.message).toEqual('MESSAGE');
            }

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(1);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });

        it('returns 3DS2 IdentifyShopper flow', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, identifyShopperError)))
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);
            await strategy.execute(getOrderRequestBody());

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });

        it('returns 3DS2 ChallengeShopper flow', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, challengeShopperError)))
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);
            await strategy.execute(getOrderRequestBody());

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });

        it('returns 3DS2 ChallengeShopper flow with default widget size', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, challengeShopperError)))
                .mockReturnValueOnce(submitPaymentAction);

            options = getInitializeOptionsWithUndefinedWidgetSize();
            await strategy.initialize(options);
            await strategy.execute(getOrderRequestBody());

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });

        it('returns 3DS2 ChallengeShopper flow with no callbacks', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, challengeShopperError)))
                .mockReturnValueOnce(submitPaymentAction);

            options = getInitializeOptionsWithNoCallbacks();
            await strategy.initialize(options);
            await strategy.execute(getOrderRequestBody());

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });

        it('returns 3DS2 IdentifyShopper flow and then 3DS2 ChallengeShopper', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, identifyShopperError)))
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, challengeShopperError)))
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);
            await strategy.execute(getOrderRequestBody());

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(3);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(2);
        });

        it('returns 3DS2 IdentifyShopper flow and then UNKNOWN_ERROR', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, identifyShopperError)))
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, getUnknownError())))
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);

            try {
                await strategy.execute(getOrderRequestBody());
            } catch (error) {
                expect(error).toBeInstanceOf(RequestError);
            }

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });

        it('returns 3DS2 ChallengeShopper flow and then UNKNOWN_ERROR', async () => {
            jest.spyOn(paymentActionCreator, 'submitPayment')
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, challengeShopperError)))
                .mockReturnValueOnce(of(createErrorAction(PaymentActionType.SubmitPaymentFailed, getUnknownError())))
                .mockReturnValueOnce(submitPaymentAction);

            await strategy.initialize(options);

            try {
                await strategy.execute(getOrderRequestBody());
            } catch (error) {
                expect(error).toBeInstanceOf(RequestError);
            }

            expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(2);

            expect(adyenCheckout.create).toHaveBeenCalledTimes(2);
            expect(adyenCheckout.createFromAction).toHaveBeenCalledTimes(1);
        });
    });

    describe('#finalize()', () => {
        it('throws an error to inform that order finalization is not required', async () => {
            const promise = strategy.finalize();

            return expect(promise).rejects.toBeInstanceOf(OrderFinalizationNotRequiredError);
        });
    });

    describe('#deinitialize', () => {
        beforeEach(() => {
            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(getAdyenV2());
        });

        it('deinitialize adyen payment strategy', async () => {
            const adyenCheckout = getAdyenCheckout();
            const adyenComponent = adyenCheckout.create('scheme', {});

            jest.spyOn(adyenV2ScriptLoader, 'load').mockReturnValue(Promise.resolve(adyenCheckout));
            jest.spyOn(adyenCheckout, 'create').mockReturnValue(adyenComponent);

            await strategy.initialize(getInitializeOptions());
            const promise = strategy.deinitialize();

            expect(adyenComponent.unmount).toHaveBeenCalled();

            return expect(promise).resolves.toBe(store.getState());
        });

        it('does not unmount when adyen component is not available', async () => {
            const promise = strategy.deinitialize();

            return expect(promise).resolves.toBe(store.getState());
        });
    });
});
