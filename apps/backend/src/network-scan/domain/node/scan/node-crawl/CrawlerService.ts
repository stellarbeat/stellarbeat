import 'reflect-metadata';
import { err, ok, Result } from 'neverthrow';
import { Crawler } from 'crawler';
import { PeerNode } from 'crawler';
import { CrawlResult as CrawlResultDTO } from 'crawler';
import { Ledger } from 'crawler';
import { NetworkQuorumSetConfiguration } from '../../../network/NetworkQuorumSetConfiguration';
import { CrawlerDTOMapper } from './CrawlerDTOMapper';
import Node from '../../Node';
import { NodeAddress } from '../../NodeAddress';
import { NodeAddressDTOComposer } from './NodeAddressDTOComposer';
import { mapUnknownToError } from '../../../../../core/utilities/mapUnknownToError';
import { NetworkQuorumSetConfigurationMapper } from '../../../network/NetworkQuorumSetConfigurationMapper';
import { QuorumSet } from 'shared';
import { CrawlFactory } from 'crawler';
import { injectable } from 'inversify';

export interface CrawlResult {
	latestClosedLedger: Ledger;
	processedLedgers: number[];
	peerNodes: Map<string, PeerNode>;
}

@injectable()
export class CrawlerService {
	constructor(private crawler: Crawler, private crawlFactory: CrawlFactory) {}

	async crawl(
		networkQuorumSet: NetworkQuorumSetConfiguration,
		nodes: Node[],
		bootstrapNodeAddresses: NodeAddress[],
		latestLedger: bigint | null,
		latestLedgerCloseTime: Date | null
	): Promise<Result<CrawlResult, Error>> {
		const nodeAddresses = NodeAddressDTOComposer.compose(
			nodes,
			bootstrapNodeAddresses,
			networkQuorumSet
		);

		if (nodeAddresses.length === 0) {
			return err(new Error('Cannot crawl network without nodes'));
		}

		const crawlResultOrError = await this.tryCrawl(
			networkQuorumSet,
			nodes,
			nodeAddresses,
			latestLedger,
			latestLedgerCloseTime
		);
		if (crawlResultOrError.isErr()) return err(crawlResultOrError.error);

		if (!CrawlerService.successFullyConnectedToAPeer(crawlResultOrError.value))
			return err(new Error('Could not connect to a single node in crawl'));

		return ok({
			latestClosedLedger: crawlResultOrError.value.latestClosedLedger,
			processedLedgers: crawlResultOrError.value.closedLedgers.map((sequence) =>
				Number(sequence)
			),
			peerNodes: crawlResultOrError.value.peers
		});
	}

	private async tryCrawl(
		networkQuorumSet: NetworkQuorumSetConfiguration,
		nodes: Node[],
		nodeAddresses: [string, number][],
		latestLedger: bigint | null,
		latestLedgerCloseTime: Date | null
	): Promise<Result<CrawlResultDTO, Error>> {
		try {
			const topTierNodesQuorumSet =
				NetworkQuorumSetConfigurationMapper.toBaseQuorumSet(networkQuorumSet);
			const topTierNodes = nodes.filter((node) =>
				QuorumSet.getAllValidators(topTierNodesQuorumSet).includes(
					node.publicKey.value
				)
			);
			const crawl = this.crawlFactory.createCrawl(
				nodeAddresses,
				CrawlerDTOMapper.mapNodeToNodeAddressDTOs(topTierNodes),
				NetworkQuorumSetConfigurationMapper.toBaseQuorumSet(networkQuorumSet),
				CrawlerDTOMapper.toLedgerDTO(latestLedger, latestLedgerCloseTime) ?? {
					sequence: BigInt(0),
					closeTime: new Date(),
					value: '',
					localCloseTime: new Date()
				},
				CrawlerDTOMapper.createQuorumSetDTOMap(nodes)
			);
			return ok(await this.crawler.startCrawl(crawl));
		} catch (e) {
			return err(mapUnknownToError(e));
		}
	}

	private static successFullyConnectedToAPeer(crawlResult: CrawlResultDTO) {
		return (
			Array.from(crawlResult.peers.values()).filter(
				(peer) => peer.successfullyConnected
			).length !== 0
		);
	}
}
