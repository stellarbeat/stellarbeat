import { Message } from '../../Message';
import { ProtocolAction } from '../../../core';
import { FederatedVotingContext } from '../../FederatedVotingContext';

export class SendMessage extends ProtocolAction {
	constructor(public readonly message: Message) {
		super();
	}

	execute(context: FederatedVotingContext): ProtocolAction[] {
		return context.sendMessage(this.message);
	}

	toString(): string {
		return `[SendMessage] ${this.message.toString()}`;
	}
}