import { Message } from '../../Message';
import { Context, ProtocolAction } from '../../../core';

export class ReceiveMessage extends ProtocolAction {
	subType = 'ReceiveMessage';
	readonly publicKey: string;

	constructor(public readonly message: Message) {
		super();
		this.publicKey = message.receiver;
	}

	execute(context: Context): ProtocolAction[] {
		return context.receiveMessage(this.message, this.isDisrupted);
	}

	toString(): string {
		return `${this.message.toString()}`;
	}

	hash(): string {
		return this.subType + this.message + this.publicKey + this.isDisrupted;
	}
}
