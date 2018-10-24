import { CheckoutButtonInitializeOptions, CheckoutButtonOptions } from '../checkout-button-options';

export default abstract class CheckoutButtonStrategy {
    protected _isInitialized: {[key: string]: boolean} = {};

    initialize(options: CheckoutButtonInitializeOptions): Promise<void> {
        this._isInitialized[options.containerId] = true;

        return Promise.resolve();
    }

    deinitialize(options: CheckoutButtonOptions): Promise<void> {
        this._isInitialized = {};

        return Promise.resolve();
    }
}
