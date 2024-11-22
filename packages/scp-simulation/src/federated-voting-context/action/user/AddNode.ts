import { Context } from '../../../core/Context';
import { Node } from '../../../core/Node';
import { ProtocolAction } from '../../../core/ProtocolAction';
import { QuorumSet } from '../../../core/QuorumSet';
import { UserAction } from '../../../core/UserAction';
import { FederatedVotingState } from '../../../federated-voting-protocol/FederatedVotingState';
import { FederatedVotingContext } from '../../FederatedVotingContext';

export class AddNode extends UserAction {
	constructor(
		public readonly publicKey: string,
		public readonly quorumSet: QuorumSet
	) {
		super();
	}

	execute(context: FederatedVotingContext): ProtocolAction[] {
		const node = new Node(this.publicKey, this.quorumSet);
		context.addNode(new FederatedVotingState(node));

		return [];
	}

	toString(): string {
		return `Add node ${this.publicKey}`;
	}
}
