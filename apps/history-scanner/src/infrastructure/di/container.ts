import { Scanner } from '../../domain/scanner/Scanner';
import { interfaces } from 'inversify';
import Container = interfaces.Container;
import { HASValidator } from '../../domain/history-archive/HASValidator';
import { CheckPointGenerator } from '../../domain/check-point/CheckPointGenerator';
import { CheckPointFrequency } from '../../domain/check-point/CheckPointFrequency';
import { TYPES } from './di-types';
import { StandardCheckPointFrequency } from '../../domain/check-point/StandardCheckPointFrequency';
import { CategoryScanner } from '../../domain/scanner/CategoryScanner';
import { BucketScanner } from '../../domain/scanner/BucketScanner';
import { RangeScanner } from '../../domain/scanner/RangeScanner';
import { VerifySingleArchive } from '../../use-cases/verify-single-archive/VerifySingleArchive';
import { VerifyArchives } from '../../use-cases/verify-archives/VerifyArchives';
import { ArchivePerformanceTester } from '../../domain/scanner/ArchivePerformanceTester';
import {
	RestartAtLeastOneScan,
	ScanScheduler
} from '../../domain/scanner/ScanScheduler';
import { ScanSettingsFactory } from '../../domain/scan/ScanSettingsFactory';
import { CategoryVerificationService } from '../../domain/scanner/CategoryVerificationService';
import { Config } from '../config/Config';
import { HttpQueue } from 'http-helper';

export function load(container: Container, config: Config) {
	container.bind(CategoryScanner).toSelf();
	container.bind(BucketScanner).toSelf();
	container.bind(HASValidator).toSelf();
	container.bind(Scanner).toSelf();
	container.bind(RangeScanner).toSelf();
	container.bind(VerifySingleArchive).toSelf();
	container.bind(VerifyArchives).toSelf();
	container.bind(CheckPointGenerator).toSelf();
	container.bind(CategoryVerificationService).toSelf();
	container.bind(ScanSettingsFactory).toDynamicValue(() => {
		return new ScanSettingsFactory(
			container.get(CategoryScanner),
			container.get(ArchivePerformanceTester),
			config.historySlowArchiveMaxLedgers
		);
	});
	container
		.bind(ArchivePerformanceTester)
		.toDynamicValue(
			() =>
				new ArchivePerformanceTester(
					container.get(CheckPointGenerator),
					container.get(HttpQueue),
					config.historyMaxFileMs
				)
		);
	container
		.bind<CheckPointFrequency>(TYPES.CheckPointFrequency)
		.toDynamicValue(() => {
			return new StandardCheckPointFrequency();
		});
	container.bind<ScanScheduler>(TYPES.ScanScheduler).toDynamicValue(() => {
		return new RestartAtLeastOneScan();
	});
}
