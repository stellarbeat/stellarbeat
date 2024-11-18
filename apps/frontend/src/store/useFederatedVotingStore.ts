import { reactive, ref, type Ref } from "vue";
import { Network } from "shared";
import { FBASQIRepository } from "@/repositories/implementation/FBASQIRepository";
import { SimulationPlayer } from "scp-simulation";

class FederatedVotingStore {
  scenarios: string[] = ["FBAS QI scenario"];
  selectedScenario: string = this.scenarios[0];
  network: Network = new Network([]);
  selectedNodeId: string | null = null;

  overlayGraphRepellingForce: Ref<number> = ref(1000);
  simulationPlayer: SimulationPlayer = new SimulationPlayer();

  constructor() {
    this.getNetwork().then((network: Network) => {
      this.network = network;
    });
    this.simulationPlayer.start();
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
