import { Url } from 'http-helper';
import { Scan } from './Scan';
import { ScanSettings } from './ScanSettings';
import { ScanError } from './ScanError';
import { ScanResult } from './ScanResult';
import { PendingScanJob } from './ScanCoordinatorService';
import { err, ok, Result } from 'neverthrow';

//a scheduled scan with optional settings. Has no start and end time yet.
export class ScanJob {
	private constructor(
		public readonly url: Url,
		public readonly latestScannedLedger = 0,
		public readonly latestScannedLedgerHeaderHash: string | null = null,
		public readonly chainInitDate: Date | null = null,
		public readonly fromLedger = 0,
		public readonly toLedger: number | null = null,
		public readonly concurrency = 0
	) {}

	static fromPendingScanJob(
		pendingScanJob: PendingScanJob
	): Result<ScanJob, Error> {
		const urlResult = Url.create(pendingScanJob.url);
		if (urlResult.isErr()) {
			return err(urlResult.error);
		}

		return ok(
			new ScanJob(
				urlResult.value,
				pendingScanJob.latestScannedLedger,
				pendingScanJob.latestScannedLedgerHeaderHash,
				pendingScanJob.chainInitDate,
				pendingScanJob.latestScannedLedger + 1,
				null,
				0
			)
		);
	}

	static continueScanChain(
		previousScan: Scan,
		toLedger: number | null = null,
		concurrency = 0
	) {
		return new ScanJob(
			previousScan.baseUrl,
			previousScan.latestScannedLedger,
			previousScan.latestScannedLedgerHeaderHash,
			previousScan.scanChainInitDate,
			previousScan.latestScannedLedger + 1,
			toLedger,
			concurrency
		);
	}

	static newScanChain(
		url: Url,
		fromLedger = 0,
		toLedger: number | null = null,
		concurrency = 0
	) {
		return new ScanJob(url, 0, null, null, fromLedger, toLedger, concurrency);
	}

	isNewScanChainJob() {
		return this.chainInitDate === null;
	}

	createFailedScanCouldNotDetermineSettings(
		startDate: Date,
		endDate: Date,
		error: ScanError
	) {
		return new Scan(
			this.chainInitDate ?? startDate,
			startDate,
			endDate,
			this.url,
			this.fromLedger,
			this.toLedger,
			this.latestScannedLedger,
			this.latestScannedLedgerHeaderHash,
			this.concurrency,
			null,
			error
		);
	}

	createScanFromScanResult(
		startDate: Date,
		endDate: Date,
		settings: ScanSettings,
		scanResult: ScanResult
	) {
		return new Scan(
			this.chainInitDate ?? startDate,
			startDate,
			endDate,
			this.url,
			settings.fromLedger,
			settings.toLedger,
			scanResult.latestLedgerHeader.ledger,
			scanResult.latestLedgerHeader.hash,
			settings.concurrency,
			settings.isSlowArchive,
			scanResult.error
		);
	}
}
