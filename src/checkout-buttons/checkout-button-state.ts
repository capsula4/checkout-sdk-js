import { CheckoutButtonMethod } from './strategies';

export default interface CheckoutButtonState {
    errors: {
        [key in CheckoutButtonMethod]?: CheckoutButtonErrorsState | undefined
    };
    statuses: {
        [key in CheckoutButtonMethod]?: CheckoutButtonStatusesState | undefined
    };
}

export interface CheckoutButtonErrorsState {
    initializeError?: Error;
    deinitializeError?: Error;
}

export interface CheckoutButtonStatusesState {
    isInitializing?: boolean;
    isDeinitializing?: boolean;
}
