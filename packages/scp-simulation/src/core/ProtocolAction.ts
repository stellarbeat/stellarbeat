import { Context } from 'vm';

//An action that is executed as a result of the protocol that is executed. For example send a message that
//is generated by the protocol. It allows the simulation to intercept these actions, log them, and give the user a
//posibility to tamper with them (todo).
export abstract class ProtocolAction {
	abstract execute(context: Context): ProtocolAction[];
	abstract toString(): string;
}
