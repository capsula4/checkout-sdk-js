import { Omit } from '../../../common/types';

import { AdyenAdditionalActionOptions, AdyenCreditCardComponentOptions, AdyenIdealComponentOptions, AdyenThreeDS2Options } from './adyenv2';

/**
 * A set of options that are required to initialize the AdyenV2 payment method.
 *
 * Once AdyenV2 payment is initialized, credit card form fields, provided by the
 * payment provider as IFrames, will be inserted into the current page. These
 * options provide a location and styling for each of the form fields.
 */
export default interface AdyenV2PaymentInitializeOptions {
    /**
     * The location to insert the Adyen component.
     */
    containerId: string;

    /**
     * @deprecated The location to insert the Adyen 3DS V2 component.
     * Use additionalActionOptions instead as this property will be removed in the future
     */
    threeDS2ContainerId: string;

    /**
     * The location to insert the Adyen custom card component
     */
    cardVerificationContainerId?: string;

    /**
     * @deprecated
     * Use additionalActionOptions instead as this property will be removed in the future
     */
    threeDS2Options: AdyenThreeDS2Options;

    /**
     * A set of options that are required to initialize additional payment actions.
     */
    additionalActionOptions: AdyenAdditionalActionOptions;

    /**
     * Optional. Overwriting the default options
     */
    options?: Omit<AdyenCreditCardComponentOptions, 'onChange'> | AdyenIdealComponentOptions;
}
