import { computed, reactive } from "vue";
import {
  FederatedVotingContext,
  FederatedVotingContextFactory,
  Simulation,
  AddNode,
  UpdateQuorumSet,
  UserAction,
  FederatedVotingProtocolState,
  QuorumSet,
  Vote,
  VoteOnStatement,
  RemoveNode,
  AddConnection,
  RemoveConnection,
  Message,
  ForgeMessage,
  FederatedVotingScenarioFactory,
  ScenarioLoader,
  Scenario,
  ScenarioSerializer,
  SimulationStepListSerializer,
  SimulationStepSerializer,
} from "scp-simulation";
import { FederatedVotingContextState } from "scp-simulation/lib/federated-voting/FederatedVotingContext";
import { findAllIntactNodes } from "@/components/federated-voting/analysis/DSetAnalysis";
import { NetworkAnalysis } from "@/components/federated-voting/analysis/NetworkAnalysis";

export interface FederatedNode {
  publicKey: string;
  trustedNodes: string[];
  trustThreshold: number;
  voted: string | null;
  accepted: string | null;
  confirmed: string | null;
  phase: string;
  processedVotes: Vote[];
}

class FederatedVotingStore {
  readonly scenarios = [
    FederatedVotingScenarioFactory.createBasicConsensus(),
    FederatedVotingScenarioFactory.createStuck(),
  ];

  private readonly _state = reactive<{
    simulationUpdate: number;
    networkStructureUpdate: number;
    overlayUpdate: number;
    selectedScenario: Scenario;
    selectedNodeId: string | null;
    protocolContext: FederatedVotingContext;
    protocolContextState: FederatedVotingContextState;
    networkAnalysis: NetworkAnalysis;
    nodes: FederatedNode[];
    overlayConnections: { publicKey: string; connections: string[] }[];
    latestSimulationStepWentForwards: boolean;
    simulation: Simulation;
  }>({
    simulationUpdate: 0,
    networkStructureUpdate: 0,
    latestSimulationStepWentForwards: false,
    selectedScenario: this.scenarios[0],
    selectedNodeId: null,
    protocolContext: FederatedVotingContextFactory.create(),
    protocolContextState: {} as FederatedVotingContextState, // temporary placeholder until constructor load
    networkAnalysis: {} as NetworkAnalysis,
    nodes: [] as FederatedNode[],
    simulation: {} as Simulation, // temporary placeholder until constructor load
    overlayConnections: [],
    overlayUpdate: 0,
  });

  private _networkStructureHash: string = "";
  private _overlayConnectionsHash: string = "";
  private scenarioLoader = new ScenarioLoader();

  constructor() {
    const result = this.scenarioLoader.loadScenario(
      this._state.selectedScenario,
    );
    this._state.protocolContext = result.protocolContext;
    this._state.protocolContextState = result.protocolContext.getState();
    this._state.simulation = result.simulation;
    this.updateNetwork();
  }

  private calculateNetworkStructureHash(): string {
    const sortedNodes = [...this.nodes].sort((a, b) =>
      a.publicKey.localeCompare(b.publicKey),
    );
    return sortedNodes
      .map((node) => {
        const trustedNodesSorted = [...node.trustedNodes].sort().join(",");
        return `${node.publicKey}:${node.trustThreshold}:[${trustedNodesSorted}]`;
      })
      .join("|");
  }

  private calculateOverlayConnectionsHash(
    connections: {
      publicKey: string;
      connections: string[];
    }[],
  ): string {
    const sortedConnections = [...connections].sort((a, b) =>
      a.publicKey.localeCompare(b.publicKey),
    );
    return sortedConnections
      .map((connection) => {
        const sortedConnections = [...connection.connections].sort().join(",");
        return `${connection.publicKey}:[${sortedConnections}]`;
      })
      .join("|");
  }

  private checkAndRecalculateNetworkAnalysis(): void {
    const newHash = this.calculateNetworkStructureHash();
    if (newHash !== this._networkStructureHash) {
      this._networkStructureHash = newHash;
      this._state.networkStructureUpdate++;
      this._state.networkAnalysis = NetworkAnalysis.analyze(this.nodes);
    }
  }

  get simulationStepDurationInSeconds(): number {
    return 2;
  }

  get networkStructureUpdate(): number {
    return this._state.networkStructureUpdate;
  }

  get selectedScenario(): Scenario {
    return this._state.selectedScenario;
  }

  get selectedNodeId(): string | null {
    return this._state.selectedNodeId;
  }

  get networkAnalysis(): NetworkAnalysis {
    return this._state.networkAnalysis;
  }

  set selectedNodeId(value: string | null) {
    this._state.selectedNodeId = value;
  }

  public selectedNode = computed(() => {
    return this.nodes.find((node) => node.publicKey === this.selectedNodeId);
  });

  private updateNetwork() {
    this.updateNodes();
    this.checkAndRecalculateNetworkAnalysis();
    this.updateOverlayConnections();
  }

  private updateNodes() {
    let nodes: FederatedNode[] =
      this._state.protocolContextState.protocolStates.map((state) =>
        this.mapStateToFederatedNode(state as FederatedVotingProtocolState),
      );

    nodes = nodes.concat(
      this.simulation
        .pendingUserActions()
        .filter((action) => action instanceof AddNode)
        .map((action) => {
          return {
            publicKey: action.publicKey,
            trustedNodes: action.quorumSet.validators.slice(),
            trustThreshold: action.quorumSet.threshold,
            voted: null,
            accepted: null,
            confirmed: null,
            phase: "unknown",
            processedVotes: [],
          };
        }),
    );

    const nodesToRemove = this.simulation
      .pendingUserActions()
      .filter((action) => action instanceof RemoveNode)
      .map((action) => action.publicKey);

    nodes = nodes.filter((node) => !nodesToRemove.includes(node.publicKey));

    this.simulation
      .pendingUserActions()
      .filter((action) => action instanceof UpdateQuorumSet)
      .forEach((action) => {
        const node = nodes.find((node) => node.publicKey === action.publicKey);
        if (!node) {
          return;
        }
        node.trustedNodes = action.quorumSet.validators.slice();
        node.trustThreshold = action.quorumSet.threshold;
      });

    this._state.nodes = nodes;
  }

  private updateOverlayConnections() {
    let connections: { publicKey: string; connections: string[] }[] = [];
    if (this.overlayIsFullyConnected) {
      connections = this.nodes.map((node) => {
        return {
          publicKey: node.publicKey,
          connections: this.nodes
            .filter((n) => n.publicKey !== node.publicKey)
            .map((n) => n.publicKey),
        };
      });
    } else {
      connections = this._state.protocolContext.overlayConnections;
    }

    // Apply pending user actions
    connections.forEach((connection) => {
      this.simulation.pendingUserActions().find((action) => {
        if (
          action instanceof AddConnection &&
          action.a === connection.publicKey
        ) {
          connection.connections.push(action.b);
        }
      });
      this.simulation.pendingUserActions().find((action) => {
        if (
          action instanceof RemoveConnection &&
          action.a === connection.publicKey
        ) {
          connection.connections = connection.connections.filter(
            (c) => c !== action.b,
          );
        }
        if (
          action instanceof RemoveConnection &&
          action.b === connection.publicKey
        ) {
          //todo: handle bidirectional connections better
          connection.connections = connection.connections.filter(
            (c) => c !== action.a,
          );
        }
      });
    });

    const hash = this.calculateOverlayConnectionsHash(connections);
    if (hash !== this._overlayConnectionsHash) {
      this._overlayConnectionsHash = hash;
      this._state.overlayConnections = connections;
      this._state.overlayUpdate++;
    }
  }

  get nodes() {
    return this._state.nodes;
  }

  get overlayConnections() {
    return this._state.overlayConnections;
  }

  public getNodeWithoutPreviewChanges(publicKey: string): FederatedNode | null {
    const state = this._state.protocolContextState.protocolStates.find(
      (state) => state.node.publicKey === publicKey,
    );

    if (!state) {
      return null;
    }

    //todo: why do we loose the type info?
    return this.mapStateToFederatedNode(state as FederatedVotingProtocolState);
  }

  private mapStateToFederatedNode(
    state: FederatedVotingProtocolState,
  ): FederatedNode {
    return {
      publicKey: state.node.publicKey,
      trustedNodes: state.node.quorumSet.validators.slice(),
      trustThreshold: state.node.quorumSet.threshold,
      voted: state.voted ? state.voted.toString() : null,
      accepted: state.accepted ? state.accepted.toString() : null,
      confirmed: state.confirmed ? state.confirmed.toString() : null,
      phase: state.phase,
      processedVotes: state.processedVotes,
    };
  }

  get illBehavedNodes() {
    return this.simulation.getDisruptedNodes();
  }

  get intactNodes() {
    return findAllIntactNodes(
      this.nodes.map((node) => node.publicKey),
      new Set(this.illBehavedNodes),
      this._state.networkAnalysis.dSets,
    );
  }

  public selectScenario(
    scenarioId: string,
    overlayIsFullyConnected?: boolean,
    overlayIsGossipEnabled?: boolean,
  ): void {
    let scenario = this.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      console.error(`Scenario with id ${scenarioId} not found`);
      return;
    }
    if (
      overlayIsFullyConnected !== undefined ||
      overlayIsGossipEnabled !== undefined
    ) {
      scenario = new Scenario(
        scenario.id,
        scenario.name,
        scenario.description,
        overlayIsFullyConnected ?? scenario.isOverlayFullyConnected,
        overlayIsGossipEnabled ?? scenario.isOverlayGossipEnabled,
        scenario.initialSimulationStep,
      );
    }

    this._state.selectedScenario = scenario;
    const result = this.scenarioLoader.loadScenario(scenario);

    this._state.protocolContext = result.protocolContext;
    this._state.protocolContextState = this._state.protocolContext.getState();
    this._state.simulation = result.simulation;
    this._state.simulationUpdate++;
    this._state.overlayUpdate++;
    this._state.networkStructureUpdate++;
    this.updateNetwork();
  }
  public resetScenario;

  //SIMULATION ACTIONS
  public getLatestEvents() {
    return this.simulation.getLatestEvents();
  }

  public updateNodeTrust(
    publicKey: string,
    trustedNodes: string[],
    threshold: number,
  ) {
    const pendingUpdate = this.simulation
      .pendingUserActions()
      .find(
        (action) =>
          action instanceof UpdateQuorumSet && action.publicKey === publicKey,
      );

    if (pendingUpdate) {
      this.simulation.cancelPendingUserAction(pendingUpdate);
    }

    this.simulation.addUserAction(
      new UpdateQuorumSet(
        publicKey,
        new QuorumSet(threshold, trustedNodes, []),
      ),
    );

    this.updateNodes();
  }

  addConnection(a: string, b: string) {
    const addConnection = new AddConnection(a, b);
    this.simulation.addUserAction(addConnection);
  }

  removeConnection(a: string, b: string) {
    const removeConnection = new RemoveConnection(a, b);
    this.simulation.addUserAction(removeConnection);
  }

  public forgeMessage(message: Message) {
    this.simulation.addUserAction(new ForgeMessage(message));
  }

  public addNode(publicKey: string, trustedNodes: string[], threshold: number) {
    this.cancelNodeRemoval(publicKey);

    if (
      this._state.protocolContextState.protocolStates.find(
        (state) => state.node.publicKey === publicKey,
      )
    ) {
      return; //already there
    }

    this.simulation.addUserAction(
      new AddNode(publicKey, new QuorumSet(threshold, trustedNodes, [])),
    );

    this.updateNetwork();
  }

  private cancelNodeRemoval(publicKey: string) {
    const pendingRemoval = this.simulation
      .pendingUserActions()
      .find(
        (action) =>
          action instanceof RemoveNode && action.publicKey === publicKey,
      );

    if (pendingRemoval) {
      this.simulation.cancelPendingUserAction(pendingRemoval);
      this.updateNetwork();
    }
  }

  private cancelNodeAdd(publicKey: string) {
    const pendingAdd = this.simulation
      .pendingUserActions()
      .find(
        (action) => action instanceof AddNode && action.publicKey === publicKey,
      );

    if (pendingAdd) {
      this.simulation.cancelPendingUserAction(pendingAdd);
      this.updateNetwork();
    }
  }

  public removeNode(publicKey: string) {
    this.cancelNodeAdd(publicKey);
    if (
      !this._state.protocolContextState.protocolStates.find(
        (state) => state.node.publicKey === publicKey,
      )
    ) {
      return; //not there, no need to remove
    }
    this.simulation.addUserAction(new RemoveNode(publicKey));
    this.updateNetwork();
  }

  public cancelNodeTrustUpdate(publicKey: string) {
    const pendingUpdate = this.simulation
      .pendingUserActions()
      .find(
        (action) =>
          action instanceof UpdateQuorumSet && action.publicKey === publicKey,
      );

    if (pendingUpdate) {
      this.simulation.cancelPendingUserAction(pendingUpdate);
      this.updateNetwork();
    }
  }

  public cancelPendingUserAction(action: UserAction) {
    this.simulation.cancelPendingUserAction(action);
    if (action.immediateExecution) {
      this.updateNetwork();
    }
  }

  private simulationUpdated(forwardDirection: boolean = true) {
    this._state.latestSimulationStepWentForwards = forwardDirection;
    this.updateNetwork();
    this._state.simulationUpdate++;
  }

  public executeStep() {
    this.simulation.executeStep();
    this.simulationUpdated(true);
  }

  public reset() {
    this.simulation.goToFirstStep();
    this.simulationUpdated(false);
  }

  public goBackOneStep() {
    this.simulation.goBackOneStep();
    this.simulationUpdated(false);
  }

  public hasNextStep() {
    return this.simulation.hasNextStep();
  }

  public hasPreviousStep() {
    return this.simulation.hasPreviousStep();
  }

  get fullEventLog() {
    return this._state.simulation.getFullEventLog();
  }

  public consensusReached = computed(() => {
    const nodes = this.nodes;
    if (!nodes.every((node) => node.confirmed)) {
      return false;
    }

    const confirmedValues = nodes
      .filter((state) => state.confirmed)
      .map((state) => state.confirmed);

    const firstConfirmedValue = confirmedValues[0];
    return confirmedValues.every((value) => value === firstConfirmedValue);
  });

  public isNetworkSplit = computed(() => {
    const confirmedStates = this.nodes.filter(
      (state) => state.confirmed !== null,
    );

    const confirmedValues = new Set(
      confirmedStates.map((state) => state.confirmed),
    );

    // If there's more than one unique value, the network is split
    return confirmedValues.size > 1;
  });

  public isStuck = computed(() => {
    return !this.simulation.hasNextStep() && !this.consensusReached.value;
  });

  public vote(publicKey: string, vote: string) {
    this.cancelPendingVote(publicKey);
    const action = new VoteOnStatement(publicKey, vote);
    this.simulation.addUserAction(action);
  }

  private cancelPendingVote(publicKey: string) {
    const vote = this.simulation
      .pendingUserActions()
      .find(
        (action) =>
          action instanceof VoteOnStatement && action.publicKey === publicKey,
      );

    if (vote) {
      this.simulation.cancelPendingUserAction(vote);
    }
  }

  public getPendingVotes() {
    return this.simulation
      .pendingUserActions()
      .filter(
        (action) => action instanceof VoteOnStatement,
      ) as VoteOnStatement[];
  }

  get simulation(): Simulation {
    return this._state.simulation as Simulation;
  }

  get simulationUpdate(): number {
    return this._state.simulationUpdate;
  }

  get overlayUpdate(): number {
    return this._state.overlayUpdate;
  }

  get latestSimulationStepWentForwards(): boolean {
    return this._state.latestSimulationStepWentForwards;
  }

  get overlayIsFullyConnected(): boolean {
    return this._state.protocolContext.overlayIsFullyConnected;
  }

  get overlayIsGossipEnabled(): boolean {
    return this._state.protocolContext.overlayIsGossipEnabled;
  }

  exportScenario() {
    const scenarioSerializer = new ScenarioSerializer(
      new SimulationStepListSerializer(new SimulationStepSerializer()),
    );

    const scenarioToExport = new Scenario(
      this.selectedScenario.id,
      this.selectedScenario.name,
      this.selectedScenario.description,
      this.overlayIsFullyConnected,
      this.overlayIsGossipEnabled,
      this.simulation.getInitialStep(), //we create a new scenario with the current state
    );
    return scenarioSerializer.toJSON(scenarioToExport);
  }

  importScenario(json: object) {
    const scenarioSerializer = new ScenarioSerializer(
      new SimulationStepListSerializer(new SimulationStepSerializer()),
    );
    const scenario = scenarioSerializer.fromJSON(json);
    const existingIndex = this.scenarios.findIndex((s) => s.id === scenario.id);
    if (existingIndex !== -1) {
      this.scenarios.splice(existingIndex, 1, scenario);
    } else {
      this.scenarios.push(scenario);
    }
    this.selectScenario(scenario.id);
  }
}

export const federatedVotingStore = new FederatedVotingStore();
