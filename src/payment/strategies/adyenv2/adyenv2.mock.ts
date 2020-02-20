import { RequestError } from '../../../common/error/errors';
import { getResponse } from '../../../common/http-request/responses.mock';
import { OrderPaymentRequestBody, OrderRequestBody } from '../../../order';
import Payment from '../../payment';
import { PaymentInitializeOptions } from '../../payment-request-options';
import { getCreditCardInstrument, getErrorPaymentResponseBody, getVaultedInstrument } from '../../payments.mock';

import { AdditionalActionErrorResponse, AdyenCheckout, AdyenConfiguration, AdyenError, ComponentState, PaymentMethodType, ResultCode } from './adyenv2';

function getAdditionalActionErrorResponse(resultCode: ResultCode): AdditionalActionErrorResponse {
    return {
        provider_data: {
            resultCode,
            action: '{"paymentData":"ADYEN_PAYMENT_DATA","paymentMethodType":"scheme","token":"TOKEN","type":"threeDS2Fingerprint"}',
        },
        errors: [
            {
                code: 'additional_action_required',
            },
        ],
    };
}

function getCardState() {
    return {
        data: {
            paymentMethod: {
                encryptedCardNumber: 'CARD_NUMBER',
                encryptedExpiryMonth: 'EXPIRY_MONTH',
                encryptedExpiryYear: 'EXPIRY_YEAR',
                encryptedSecurityCode: 'CVV',
                type: PaymentMethodType.Scheme,
            },
        },
    };
}

function getPayment(paymentMethodType: PaymentMethodType): Payment {
    return {
        methodId: paymentMethodType,
        paymentData: getCreditCardInstrument(),
    };
}

function getUnknownErrorResponse(): any {
    return {
        errors: [
            {
                code: 'unknown_error',
            },
        ],
    };
}

function getVaultedPayment(paymentMethodType: PaymentMethodType): Payment {
    return {
        methodId: paymentMethodType,
        paymentData: getVaultedInstrument(),
    };
}

export function getAdditionalActionError(resultCode: ResultCode): RequestError {
    return new RequestError(getResponse({
        ...getErrorPaymentResponseBody(),
        ...getAdditionalActionErrorResponse(resultCode),
    }));
}

export function getAdyenConfiguration(): AdyenConfiguration {
    return {
        environment: 'test',
        originKey: 'YOUR_ORIGIN_KEY',
    };
}

export function getAdyenCheckout(): AdyenCheckout {
    return {
        create: jest.fn(() => {
            return {
                mount: jest.fn(),
                unmount: jest.fn(),
            };
        }),

        createFromAction: jest.fn(() => {
            return {
                mount: jest.fn(),
                unmount: jest.fn(),
            };
        }),
    };
}

export function getAdyenError(): AdyenError {
    return {
        errorCode: 'CODE',
        message: 'MESSAGE',
    };
}

export function getInitializeOptions(): PaymentInitializeOptions {
    return {
        methodId: 'adyenv2',
        adyenv2: {
            containerId: 'adyen-scheme-component-field',
            cardVerificationContainerId: 'adyen-custom-card-component-field',
            threeDS2ContainerId: 'adyen-scheme-3ds-component-field',
            options: {
                hasHolderName: true,
                styles: {},
                placeholders: {},
            },
            threeDS2Options: {
                widgetSize: '05',
                onBeforeLoad: jest.fn(),
                onComplete: jest.fn(),
                onLoad: jest.fn(),
            },
            additionalActionOptions: {
                containerId: 'adyen-scheme-additional-action-component-field',
                onBeforeLoad: jest.fn(),
                onComplete: jest.fn(),
                onLoad: jest.fn(),
            },
        },
    };
}

export function getInitializeOptionsWithNoCallbacks(): PaymentInitializeOptions {
    return {
        methodId: 'adyenv2',
        adyenv2: {
            containerId: 'adyen-scheme-component-field',
            cardVerificationContainerId: 'adyen-custom-card-component-field',
            threeDS2ContainerId: 'adyen-scheme-3ds-component-field',
            options: {
                hasHolderName: true,
                styles: {},
                placeholders: {},
            },
            threeDS2Options: {
                widgetSize: '05',
            },
            additionalActionOptions: {
                containerId: 'adyen-scheme-additional-action-component-field',
            },
        },
    };
}

export function getInitializeOptionsWithUndefinedWidgetSize(): PaymentInitializeOptions {
    return {
        methodId: 'adyenv2',
        adyenv2: {
            containerId: 'adyen-scheme-component-field',
            cardVerificationContainerId: 'adyen-custom-card-component-field',
            threeDS2ContainerId: 'adyen-scheme-3ds-component-field',
            options: {
                hasHolderName: true,
                styles: {},
                placeholders: {},
            },
            threeDS2Options: {
                onBeforeLoad: jest.fn(),
                onComplete: jest.fn(),
                onLoad: jest.fn(),
            },
            additionalActionOptions: {
                containerId: 'adyen-scheme-additional-action-component-field',
                onBeforeLoad: jest.fn(),
                onComplete: jest.fn(),
                onLoad: jest.fn(),
            },
        },
    };
}

export function getOrderRequestBody(paymentMethodType: PaymentMethodType = PaymentMethodType.Scheme): OrderRequestBody {
    return {
        useStoreCredit: false,
        payment: getPayment(paymentMethodType) as OrderPaymentRequestBody,
    };
}

export function getOrderRequestBodyWithVaultedInstrument(paymentMethodType: PaymentMethodType = PaymentMethodType.Scheme): OrderRequestBody {
    return {
        useStoreCredit: false,
        payment: getVaultedPayment(paymentMethodType) as OrderPaymentRequestBody,
    };
}

export function getOrderRequestBodyWithoutPayment(): OrderRequestBody {
    return {
        useStoreCredit: false,
        payment: undefined,
    };
}

export function getUnknownError(): RequestError {
    return new RequestError(getResponse({
        ...getUnknownErrorResponse(),
        ...getErrorPaymentResponseBody(),
    }));
}

export function getValidCardState(): ComponentState {
    return {
        ...getCardState(),
        isValid: true,
    };
}
