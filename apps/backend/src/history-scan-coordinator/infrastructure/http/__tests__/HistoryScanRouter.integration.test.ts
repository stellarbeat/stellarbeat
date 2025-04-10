import express from 'express';
import request from 'supertest';
import { mock } from 'jest-mock-extended';
import { ok, err } from 'neverthrow';
import { HistoryScanRouterWrapper } from '../HistoryScanRouter';
import { Url } from 'http-helper';
import { GetLatestScan } from '../../../use-cases/get-latest-scan/GetLatestScan';
import { RegisterScan } from '../../../use-cases/register-scan/RegisterScan';
import { InvalidUrlError } from '../../../use-cases/get-latest-scan/InvalidUrlError';
import { ScanDTO } from 'history-scanner-dto';
import { ScanJob } from '../../../domain/ScanJob';
import { GetScanJob } from '../../../use-cases/get-scan-job/GetScanJob';

describe('HistoryScanRouter.integration', () => {
	let app: express.Application;
	let getLatestScan: jest.Mocked<GetLatestScan>;
	let registerScan: jest.Mocked<RegisterScan>;
	let getScanJob: jest.Mocked<GetScanJob>;

	beforeEach(() => {
		getLatestScan = mock<GetLatestScan>();
		registerScan = mock<RegisterScan>();
		getScanJob = mock<GetScanJob>();

		app = express();
		app.use(express.json());
		app.use(
			'/history-scan',
			HistoryScanRouterWrapper({
				getLatestScan,
				registerScan,
				getScanJob,
				userName: 'admin',
				password: 'secret'
			})
		);
	});

	describe('GET /:url', () => {
		it('should return 400 for invalid URL', async () => {
			await request(app)
				.get('/history-scan/invalid-url')
				.expect(400)
				.expect('Content-Type', /json/)
				.expect((response) => {
					expect(response.body.errors).toBeDefined();
				});
		});

		it('should return 400 when InvalidUrlError', async () => {
			getLatestScan.execute.mockResolvedValue(
				err(new InvalidUrlError('test.com'))
			);

			await request(app)
				.get('/history-scan/https%3A%2F%2Ftest.com')
				.expect(400)
				.expect((response) => {
					expect(response.body.error).toBe('Invalid url');
				});
		});
	});

	describe('POST /', () => {
		it('should require authentication', async () => {
			await request(app).post('/history-scan').send({}).expect(401);
		});

		it('should validate request body', async () => {
			await request(app)
				.post('/history-scan')
				.auth('admin', 'secret')
				.send({})
				.expect(400)
				.expect((response) => {
					expect(response.body.errors).toBeDefined();
				});
		});

		it('should register a new scan', async () => {
			const urlResult = Url.create('https://test.com');
			if (urlResult.isErr()) throw urlResult.error;

			const validBody: ScanDTO = {
				startDate: new Date(),
				endDate: new Date(),
				baseUrl: urlResult.value.value,
				scanChainInitDate: new Date(),
				latestVerifiedLedger: 100,
				latestScannedLedger: 100,
				latestScannedLedgerHeaderHash: null,
				concurrency: 5,
				isSlowArchive: false,
				fromLedger: 0,
				toLedger: null,
				error: null,
				scanJobRemoteId: 'test'
			};
			console.log(JSON.parse(JSON.stringify(validBody)));

			registerScan.execute.mockResolvedValue(ok(undefined));

			await request(app)
				.post('/history-scan')
				.auth('admin', 'secret')
				.send(JSON.parse(JSON.stringify(validBody)))
				.expect(201)
				.expect((response) => {
					expect(response.body.message).toBe('Scan created successfully');
				});

			expect(registerScan.execute).toHaveBeenCalledWith(validBody);
		});
	});

	describe('GET /job', () => {
		it('should return 401 without authentication', async () => {
			await request(app).get('/history-scan/job').expect(401);
		});

		it('should return 401 with wrong credentials', async () => {
			await request(app)
				.get('/history-scan/job')
				.auth('admin', 'wrong-secret')
				.expect(401);
		});

		it('should return scan job when authenticated', async () => {
			const mockJob: ScanJob = new ScanJob('https://test.com', 100, 'hash');

			getScanJob.execute.mockResolvedValue(ok(mockJob));

			await request(app)
				.get('/history-scan/job')
				.auth('admin', 'secret')
				.expect(200)
				.expect('Content-Type', /json/)
				.expect((response) => {
					expect(response.body).toEqual(mockJob);
				});

			expect(getScanJob.execute).toHaveBeenCalled();
		});

		it('should return 500 when getScanJob fails', async () => {
			getScanJob.execute.mockResolvedValue(err(new Error('Database error')));

			await request(app)
				.get('/history-scan/job')
				.auth('admin', 'secret')
				.expect(500)
				.expect('Content-Type', /json/)
				.expect((response) => {
					expect(response.body.error).toBeDefined();
				});
		});

		it('should return 204 when no scan job available', async () => {
			getScanJob.execute.mockResolvedValue(ok(null));

			await request(app)
				.get('/history-scan/job')
				.auth('admin', 'secret')
				.expect(204);
		});
	});
});
