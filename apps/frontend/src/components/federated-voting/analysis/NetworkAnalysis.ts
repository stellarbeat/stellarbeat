import { findSubSetsOfSize } from "./Sets";
import {
  findAllDSets,
  findMinimalQuorums,
  findQuorums,
  hasQuorumIntersection,
} from "./DSetAnalysis";
import { FederatedNode } from "@/store/useFederatedVotingStore";

type PublicKey = string;

/**
 * Holds the analysis data for a network of nodes.
 * Use `NetworkAnalysis.analyze(nodes)` to create an instance.
 */
export class NetworkAnalysis {
  /**
   * All D-Sets found in the network. (Each set is a Set of node public keys.)
   */
  public readonly dSets: Set<PublicKey>[];

  /**
   * For each node, the possible quorum slices (subsets + itself).
   * Keyed by the node's public key.
   */
  public readonly quorumSlices: Map<PublicKey, Set<PublicKey>[]>;

  /**
   * All quorums found in the network. (A quorum is a Set of node public keys.)
   */
  public readonly quorums: Set<PublicKey>[];

  /**
   * Subset of the quorums which are minimal (no proper subset is still a quorum).
   */
  public readonly minimalQuorums: Set<PublicKey>[];

  /**
   * A set of nodes that appear in at least one minimal quorum.
   */
  public readonly topTierNodes: Set<PublicKey>;

  /**
   *  Whether the network has quorum intersection. Every quorum overlaps with any other other quorum.
   */
  public readonly hasQuorumIntersection: boolean;

  private constructor(
    dSets: Set<PublicKey>[],
    quorumSlices: Map<PublicKey, Set<PublicKey>[]>,
    quorums: Set<PublicKey>[],
    minimalQuorums: Set<PublicKey>[],
    topTierNodes: Set<PublicKey>,
    hasQuorumIntersection: boolean,
  ) {
    this.dSets = dSets;
    this.quorumSlices = quorumSlices;
    this.quorums = quorums;
    this.minimalQuorums = minimalQuorums;
    this.topTierNodes = topTierNodes;
    this.hasQuorumIntersection = hasQuorumIntersection;
  }

  /**
   * Analyze an array of Nodes to produce a NetworkAnalysis snapshot.
   */
  public static analyze(nodes: FederatedNode[]): NetworkAnalysis {
    const quorumSlices = new Map<PublicKey, Set<PublicKey>[]>(
      nodes.map((node) => [
        node.publicKey, //always include self
        Array.from(
          findSubSetsOfSize(
            new Set(node.trustedNodes),
            node.trustThreshold,
          ).map((subset) => subset.add(node.publicKey)),
        ),
      ]),
    );

    const dSets = findAllDSets({
      nodes: nodes.map((node) => node.publicKey),
      Q: quorumSlices,
    });

    const quorums = findQuorums(
      nodes.map((node) => node.publicKey),
      quorumSlices,
    );

    const minimalQuorums = findMinimalQuorums(quorums);

    const topTierNodes = new Set<PublicKey>();
    minimalQuorums.forEach((quorum) => {
      quorum.forEach((publicKey) => topTierNodes.add(publicKey));
    });

    return new NetworkAnalysis(
      dSets,
      quorumSlices,
      quorums,
      minimalQuorums,
      topTierNodes,
      hasQuorumIntersection(minimalQuorums),
    );
  }
}
