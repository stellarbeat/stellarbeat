import { Event, Context, UserAction, ProtocolAction, Node } from '../core';
import { AddConnection, RemoveConnection } from '../overlay';

//A step in the simulation. Contains all user and protocol actions to be executed next
//and stores the state and events that got us here.
//Linked list
interface SimulationStep {
	userActions: UserAction[];
	protocolActions: ProtocolAction[];
	previousEvents: Event[]; //the events executed in the previous step. Todo: or store executed events? Improve naming?
	nextStep: SimulationStep | null;
	previousStep: SimulationStep | null;
	previousStepHash: string;
}

//The simulation. Works on a context and manages the user and protocol actions. Provides an eventlog, and allows to replay the simulation.
export class Simulation {
	private initialStep: SimulationStep; //handy to replay the state
	private currentStep: SimulationStep;

	constructor(private context: Context) {
		this.currentStep = {
			userActions: [],
			protocolActions: [],
			previousEvents: [],
			nextStep: null,
			previousStep: null,
			previousStepHash: ''
		};
		this.initialStep = this.currentStep;
	}

	getFullEventLog(): Event[][] {
		const events: Event[][] = [];
		let stepIterator: SimulationStep | null = this.initialStep;
		while (
			stepIterator !== this.currentStep.nextStep &&
			stepIterator !== null
		) {
			events.push(stepIterator.previousEvents);
			stepIterator = stepIterator.nextStep;
		}
		return events;
	}

	getDisruptedNodes(): string[] {
		//todo: this should not belong to the simulation
		const disruptedNodes: Set<string> = new Set();
		let stepIterator: SimulationStep | null = this.initialStep;
		while (
			stepIterator !== this.currentStep.nextStep &&
			stepIterator !== null
		) {
			stepIterator.protocolActions
				.filter((action) => action.isDisrupted)
				.forEach((action) => {
					disruptedNodes.add(action.publicKey);
				});
			stepIterator = stepIterator.nextStep;
		}

		return Array.from(disruptedNodes);
	}

	getLatestEvents(): Event[] {
		return this.currentStep.previousEvents;
	}

	public loadInitialNodes(nodes: Node[]): void {
		this.context.loadInitialNodes(nodes);
	}

	//in every step you can only add a specific action only once for a node
	public addUserAction(action: UserAction): void {
		const existingAction = this.currentStep.userActions.find(
			(a) =>
				a.subType === action.subType &&
				a.publicKey === action.publicKey &&
				!(action instanceof AddConnection || action instanceof RemoveConnection) //todo: we need a better solution! Maybe isIdempotent Prop?
		);
		if (existingAction) {
			const index = this.currentStep.userActions.indexOf(existingAction);
			this.currentStep.userActions[index] = action;
			return;
		}

		// If action requires immediate execution, add to front of array
		// these actions are previewed by the GUI
		if (action.immediateExecution) {
			this.currentStep.userActions.unshift(action);
		} else {
			// Otherwise add to end as before
			this.currentStep.userActions.push(action);
		}
	}

	public pendingUserActions(): UserAction[] {
		return this.currentStep.userActions;
	}

	public cancelPendingUserAction(userAction: UserAction) {
		const index = this.currentStep.userActions.indexOf(userAction);
		if (index > -1) {
			this.currentStep.userActions.splice(index, 1);
		}
	}

	public pendingProtocolActions(): ProtocolAction[] {
		return this.currentStep.protocolActions;
	}

	private calculateStepHash(step: SimulationStep): string {
		return step.userActions
			.map((a) => a.toString())
			.concat(step.protocolActions.map((a) => a.toString()))
			.join('|')
			.concat(step.protocolActions.map((a) => a.hash()).join('|'));
	}

	//Executes the pending actions. UserActions are always first, then protocol actions
	public executeStep() {
		const newActions = this.context.executeActions(
			this.currentStep.protocolActions,
			this.currentStep.userActions
		);
		const stepHash = this.calculateStepHash(this.currentStep);

		//because we want to be able to replay predefined scenarios,
		//only when the current step has not been modified
		if (
			this.currentStep.nextStep !== null &&
			this.currentStep.nextStep.previousStepHash === stepHash
		) {
			this.context.drainEvents();
			this.currentStep = this.currentStep.nextStep;
			return; //context is deterministic, and if we are playing a scenario, we can reuse the next step, if there is one
		}

		const nextStep: SimulationStep = {
			userActions: [],
			protocolActions: newActions,
			previousEvents: this.context.drainEvents(),
			nextStep: null,
			previousStep: this.currentStep,
			previousStepHash: stepHash
		};

		//todo: sanity check that garbage collection picks up discarded next steps
		this.currentStep.nextStep = nextStep;
		this.currentStep = nextStep;
	}

	public hasNextStep() {
		return (
			this.currentStep.nextStep !== null ||
			this.currentStep.userActions.length > 0 ||
			this.currentStep.protocolActions.length > 0
		);
	}

	hasPreviousStep() {
		return this.currentStep.previousStep !== null;
	}

	goBackOneStep(): void {
		if (this.currentStep.previousStep !== null) {
			this.currentStep = this.currentStep.previousStep;
			this.replayState();
		}
	}

	//event sourcing the state
	private replayState() {
		this.context.reset();
		let stepIterator = this.initialStep;
		while (stepIterator !== this.currentStep) {
			this.context.executeActions(
				stepIterator.protocolActions,
				stepIterator.userActions
			);
			this.context.drainEvents();
			//we assume the context is deterministic and we don't need to store the generated actions and events

			if (stepIterator.nextStep === null) {
				break; //should not happen...
			}

			stepIterator = stepIterator.nextStep;
		}
	}

	goToFirstStep(): void {
		this.currentStep = this.initialStep;
		this.context.reset();
		this.context.drainEvents();
	}
}
