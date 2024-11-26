import { reactive, ref, type Ref } from "vue";
import { Network } from "shared";
import { FBASQIRepository } from "@/repositories/implementation/FBASQIRepository";
import {
  BasicFederatedVotingScenario,
  FederatedVotingContext,
  FederatedVotingContextFactory,
  Simulation,
} from "scp-simulation";
import { FederatedVotingContextState } from "scp-simulation/lib/federated-voting/FederatedVotingContext";

class FederatedVotingStore {
  scenarios: string[] = ["FBAS QI scenario"];
  selectedScenario: string = this.scenarios[0];
  network: Network = new Network([]);
  selectedNodeId: string | null = null;

  protocolContext: FederatedVotingContext;
  protocolContextState: FederatedVotingContextState;
  simulation: Simulation;

  overlayGraphRepellingForce: Ref<number> = ref(1000);

  constructor() {
    this.getNetwork().then((network: Network) => {
      this.network = network;
    });

    this.protocolContext = FederatedVotingContextFactory.create();
    this.protocolContextState = reactive({
      protocolStates: [],
    });
    this.protocolContext.setState(this.protocolContextState); //need to think of a better solution for reactivity
    this.simulation = new Simulation(this.protocolContext);
    BasicFederatedVotingScenario.load(this.simulation);
  }

  private getNetwork = async () => {
    const networkRepository = new FBASQIRepository();
    const networkOrError = await networkRepository.find();
    if (networkOrError.isErr()) {
      return new Network([]);
    }

    return networkOrError.value;
  };
}

export const federatedVotingStore = reactive<FederatedVotingStore>(
  new FederatedVotingStore(),
);
