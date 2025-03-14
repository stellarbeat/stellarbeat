import {
	Node as NetworkNode,
	Connection,
	createSCPEnvelopeSignature,
	createNode,
	getConfigFromEnv
} from 'node-connector';
import { xdr, Keypair, hash, Networks } from '@stellar/stellar-base';
import { QuorumSet } from 'shared';
import { NodeConfig } from 'node-connector';
import { ok, Result, err } from 'neverthrow';
import {
	CrawlerConfiguration,
	createCrawler,
	createCrawlFactory
} from '../index';
import { StellarMessageWork } from 'node-connector';
import { NodeAddress } from '../node-address';

jest.setTimeout(60000);

let peerNodeAddress: NodeAddress;
let peerNetworkNode: NetworkNode;

let crawledPeerNetworkNode: NetworkNode;
let crawledPeerNodeAddress: NodeAddress;

let publicKeyReusingPeerNodeAddress: NodeAddress;
let publicKeyReusingPeerNetworkNode: NetworkNode;

let qSet: xdr.ScpQuorumSet;
beforeEach(() => {
	peerNodeAddress = ['127.0.0.1', 11621];
	peerNetworkNode = getListeningPeerNode(peerNodeAddress);
	crawledPeerNodeAddress = ['127.0.0.1', 11622];
	crawledPeerNetworkNode = getListeningPeerNode(crawledPeerNodeAddress);
	publicKeyReusingPeerNodeAddress = ['127.0.0.1', 11623];
	publicKeyReusingPeerNetworkNode = getListeningPeerNode(
		publicKeyReusingPeerNodeAddress,
		peerNetworkNode.keyPair.secret()
	);
	qSet = new xdr.ScpQuorumSet({
		threshold: 1,
		validators: [
			xdr.PublicKey.publicKeyTypeEd25519(
				crawledPeerNetworkNode.keyPair.rawPublicKey()
			),
			xdr.PublicKey.publicKeyTypeEd25519(peerNetworkNode.keyPair.rawPublicKey())
		],
		innerSets: []
	});
});

afterEach((done) => {
	let counter = 0;

	const cleanup = () => {
		counter++;
		if (counter === 2) {
			done();
		}
	};
	peerNetworkNode.stopAcceptingIncomingConnections(cleanup);
	crawledPeerNetworkNode.stopAcceptingIncomingConnections(cleanup);
	publicKeyReusingPeerNetworkNode.stopAcceptingIncomingConnections(cleanup);
});

it('should crawl, listen for validating nodes and harvest quorumSets', async () => {
	peerNetworkNode.on('connection', (connection: Connection) => {
		connection.on('connect', () => {
			const peerAddress = new xdr.PeerAddress({
				ip: xdr.PeerAddressIp.iPv4(Buffer.from([127, 0, 0, 1])),
				port: crawledPeerNodeAddress[1],
				numFailures: 0
			});
			const peers = xdr.StellarMessage.peers([peerAddress]);
			connection.sendStellarMessage(peers);
			const externalizeResult = createExternalizeMessage(peerNetworkNode);
			if (externalizeResult.isOk()) {
				connection.sendStellarMessage(externalizeResult.value, (error) => {
					if (error) console.log(error);
				});
			} else console.log(externalizeResult.error);
		});
		connection.on('data', (stellarMessageWork: StellarMessageWork) => {
			const stellarMessage = stellarMessageWork.stellarMessage;
			switch (stellarMessage.switch()) {
				case xdr.MessageType.getScpQuorumset(): {
					const dontHave = new xdr.DontHave({
						reqHash: stellarMessage.qSetHash(),
						type: xdr.MessageType.getScpQuorumset()
					});
					const dontHaveMessage = xdr.StellarMessage.dontHave(dontHave);
					connection.sendStellarMessage(dontHaveMessage);
				}
			}
		});
		connection.on('error', (error: Error) => console.log(error));

		connection.on('close', () => {
			return;
		});
		connection.on('end', (error?: Error) => {
			connection.destroy(error);
		});
	});
	peerNetworkNode.on('close', () => {
		console.log('seed peer server close');
	});

	crawledPeerNetworkNode.on('connection', (connection: Connection) => {
		connection.on('connect', () => {
			const externalizeResult = createExternalizeMessage(
				crawledPeerNetworkNode
			);
			if (externalizeResult.isOk()) {
				connection.sendStellarMessage(externalizeResult.value, (error) => {
					if (error) console.log(error);
				});
			}
		});
		connection.on('data', (stellarMessageWork: StellarMessageWork) => {
			const stellarMessage = stellarMessageWork.stellarMessage;
			switch (stellarMessage.switch()) {
				case xdr.MessageType.getScpQuorumset(): {
					const qSetMessage = xdr.StellarMessage.scpQuorumset(qSet);
					connection.sendStellarMessage(qSetMessage);
				}
			}
		});
		connection.on('error', (error: Error) => console.log(error));

		connection.on('close', () => {
			return;
		});
		connection.on('end', (error?: Error) => {
			connection.destroy(error);
		});
	});
	crawledPeerNetworkNode.on('close', () => {
		console.log('crawled peer server close');
	});

	const trustedQSet = new QuorumSet(2, [
		peerNetworkNode.keyPair.publicKey(),
		crawledPeerNetworkNode.keyPair.publicKey()
	]);

	const nodeConfig: NodeConfig = {
		network: Networks.TESTNET,
		nodeInfo: {
			ledgerVersion: 1,
			overlayVersion: 1,
			overlayMinVersion: 1,
			versionString: '1.0.0',
			networkId: Networks.TESTNET
		},
		listeningPort: 11026,
		receiveTransactionMessages: false,
		receiveSCPMessages: true,
		peerFloodReadingCapacity: 200,
		flowControlSendMoreBatchSize: 40,
		peerFloodReadingCapacityBytes: 300000,
		flowControlSendMoreBatchSizeBytes: 100000
	};

	const crawlerConfig = new CrawlerConfiguration(nodeConfig);
	crawlerConfig.peerStraggleTimeoutMS = 2000;
	crawlerConfig.syncingTimeoutMS = 100;
	crawlerConfig.quorumSetRequestTimeoutMS = 100;
	const crawler = createCrawler(crawlerConfig);
	const crawlerFactory = createCrawlFactory(crawlerConfig);
	const crawl = crawlerFactory.createCrawl(
		[peerNodeAddress, publicKeyReusingPeerNodeAddress],
		[],
		trustedQSet,
		{
			sequence: BigInt(0),
			closeTime: new Date(0),
			value: '',
			localCloseTime: new Date(0)
		},
		new Map<string, QuorumSet>()
	);

	const result = await crawler.startCrawl(crawl);
	const peerNode = result.peers.get(peerNetworkNode.keyPair.publicKey());
	expect(peerNode).toBeDefined();
	if (!peerNode) return;
	const crawledPeerNode = result.peers.get(
		crawledPeerNetworkNode.keyPair.publicKey()
	);
	expect(peerNode.successfullyConnected).toBeTruthy();
	expect(peerNode.isValidating).toBeTruthy();
	expect(peerNode.overLoaded).toBeFalsy();
	expect(peerNode.participatingInSCP).toBeTruthy();
	expect(peerNode.latestActiveSlotIndex).toEqual('1');
	expect(peerNode.suppliedPeerList).toBeTruthy();
	expect(peerNode.quorumSetHash).toEqual(hash(qSet.toXDR()).toString('base64'));
	expect(peerNode.quorumSet).toBeDefined();
	expect(crawledPeerNode).toBeDefined();
	if (!crawledPeerNode) return;
	expect(crawledPeerNode.quorumSetHash).toEqual(
		hash(qSet.toXDR()).toString('base64')
	);
	expect(crawledPeerNode.quorumSet).toBeDefined();
	expect(crawledPeerNode.isValidating).toBeTruthy();
	expect(crawledPeerNode.participatingInSCP).toBeTruthy();
	expect(crawledPeerNode.latestActiveSlotIndex).toEqual('1');
});

it('should hit the max crawl limit', async function () {
	const trustedQSet = new QuorumSet(2, [
		peerNetworkNode.keyPair.publicKey(),
		crawledPeerNetworkNode.keyPair.publicKey()
	]);

	const nodeConfig = getConfigFromEnv();
	nodeConfig.network = Networks.TESTNET;

	const crawlerConfig = new CrawlerConfiguration(
		nodeConfig,
		25,
		1000,
		new Set(),
		1000,
		100,
		100
	);
	const crawler = createCrawler(crawlerConfig);
	const crawlFactory = createCrawlFactory(crawlerConfig);

	const crawl = crawlFactory.createCrawl(
		[peerNodeAddress, publicKeyReusingPeerNodeAddress],
		[],
		trustedQSet,
		{
			sequence: BigInt(0),
			closeTime: new Date(0),
			value: '',
			localCloseTime: new Date(0)
		},
		new Map<string, QuorumSet>()
	);

	try {
		expect(await crawler.startCrawl(crawl)).toThrowError();
	} catch (e) {
		expect(e).toBeInstanceOf(Error);
	}
});

function createExternalizeMessage(
	node: NetworkNode
): Result<xdr.StellarMessage, Error> {
	const commit = new xdr.ScpBallot({ counter: 1, value: Buffer.alloc(32) });
	const externalize = new xdr.ScpStatementExternalize({
		commit: commit,
		nH: 1,
		commitQuorumSetHash: hash(qSet.toXDR())
	});
	const pledges = xdr.ScpStatementPledges.scpStExternalize(externalize);

	const statement = new xdr.ScpStatement({
		nodeId: xdr.PublicKey.publicKeyTypeEd25519(node.keyPair.rawPublicKey()),
		slotIndex: xdr.Uint64.fromString('1'),
		pledges: pledges
	});
	const signatureResult = createSCPEnvelopeSignature(
		statement,
		node.keyPair.rawPublicKey(),
		node.keyPair.rawSecretKey(),
		hash(Buffer.from(Networks.TESTNET))
	);
	if (signatureResult.isOk()) {
		const envelope = new xdr.ScpEnvelope({
			statement: statement,
			signature: signatureResult.value
		});
		const message = xdr.StellarMessage.scpMessage(envelope);
		return ok(message);
	}
	return err(signatureResult.error);
}

function getListeningPeerNode(address: NodeAddress, privateKey?: string) {
	const peerNodeConfig: NodeConfig = {
		network: Networks.TESTNET,
		nodeInfo: {
			ledgerVersion: 1,
			overlayMinVersion: 1,
			overlayVersion: 20,
			versionString: '1'
		},
		listeningPort: address[1],
		privateKey: privateKey ? privateKey : Keypair.random().secret(),
		receiveSCPMessages: true,
		receiveTransactionMessages: false,
		peerFloodReadingCapacity: 200,
		flowControlSendMoreBatchSize: 40,
		peerFloodReadingCapacityBytes: 300000,
		flowControlSendMoreBatchSizeBytes: 100000
	};
	const peerNetworkNode = createNode(peerNodeConfig);
	peerNetworkNode.acceptIncomingConnections(address[1], address[0]);

	return peerNetworkNode;
}
