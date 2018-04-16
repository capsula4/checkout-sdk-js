import isVaultedInstrument from './is-vaulted-instrument';
import { CreditCard, PaymentInstrument } from './payment';

export default function isCreditCardLike(creditCard: PaymentInstrument): creditCard is CreditCard {
    const card = creditCard as CreditCard;

    return !isVaultedInstrument(card) &&
        typeof card.ccName === 'string' &&
        typeof card.ccNumber === 'string' &&
        typeof card.ccType === 'string' &&
        typeof card.ccExpiry === 'object' &&
        typeof card.ccExpiry.month === 'string' &&
        typeof card.ccExpiry.year === 'string';
    }
