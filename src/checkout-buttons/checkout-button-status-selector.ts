import { InternalCheckoutSelectors } from '../checkout';
import { selector } from '../common/selector';

import CheckoutButtonSelector from './checkout-button-selector';
import { CheckoutButtonMethod } from './strategies';

@selector
export default class CheckoutButtonStatusSelector {
    private _checkoutButton: CheckoutButtonSelector;

    /**
     * @internal
     */
    constructor(selectors: InternalCheckoutSelectors) {
        this._checkoutButton = selectors.checkoutButton;
    }

    isInitializingButton(methodId?: CheckoutButtonMethod): boolean {
        return this._checkoutButton.isInitializing(methodId);
    }

    isDeinitializingButton(methodId?: CheckoutButtonMethod): boolean {
        return this._checkoutButton.isDeinitializing(methodId);
    }
}
