import { VerifySingleArchive } from '../../use-cases/verify-single-archive/VerifySingleArchive';
import Kernel from '../Kernel';

// noinspection JSIgnoredPromiseFromCall
main();

async function main() {
	const kernel = await Kernel.getInstance();
	const verifySingleArchive = kernel.container.get(VerifySingleArchive);
	//handle shutdown
	process
		.on('SIGTERM', async () => {
			await kernel.shutdown();
			process.exit(0);
		})
		.on('SIGINT', async () => {
			await kernel.shutdown();
			process.exit(0);
		});

	let persist = false;
	if (process.argv[2] === '1') {
		persist = true;
	}

	const historyUrl = process.argv[3];

	let fromLedger: number | undefined = undefined;
	if (!isNaN(Number(process.argv[4]))) {
		fromLedger = Number(process.argv[4]);
	}

	let toLedger: number | undefined = undefined;
	if (!isNaN(Number(process.argv[5]))) {
		toLedger = Number(process.argv[5]);
	}

	let concurrency: number | undefined = undefined;
	if (!isNaN(Number(process.argv[6]))) {
		concurrency = Number(process.argv[6]);
	}

	const result = await verifySingleArchive.execute({
		toLedger: toLedger,
		fromLedger: fromLedger,
		maxConcurrency: concurrency,
		historyUrl: historyUrl
	});

	if (result.isErr()) {
		console.log(result.error);
	}
}
