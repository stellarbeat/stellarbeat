import express from 'express';
import request from 'supertest';
import { mock } from 'jest-mock-extended';
import { ok, err } from 'neverthrow';
import { HistoryScanRouterWrapper } from '../HistoryScanRouter';
import { Url } from 'http-helper';
import { GetLatestScan } from '../../../use-cases/get-latest-scan/GetLatestScan';
import { RegisterScan } from '../../../use-cases/register-scan/RegisterScan';
import { InvalidUrlError } from '../../../use-cases/get-latest-scan/InvalidUrlError';
import { ScanDTO } from '../../../use-cases/register-scan/ScanDTO';

describe('HistoryScanRouter.integration', () => {
	let app: express.Application;
	let getLatestScan: jest.Mocked<GetLatestScan>;
	let registerScan: jest.Mocked<RegisterScan>;

	beforeEach(() => {
		getLatestScan = mock<GetLatestScan>();
		registerScan = mock<RegisterScan>();

		app = express();
		app.use(express.json());
		app.use(
			'/history-scan',
			HistoryScanRouterWrapper({
				getLatestScan,
				registerScan,
				writeSecret: 'secret'
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
				error: null
			};

			registerScan.execute.mockResolvedValue(ok(undefined));

			await request(app)
				.post('/history-scan')
				.auth('admin', 'secret')
				.send(validBody)
				.expect(201)
				.expect((response) => {
					expect(response.body.message).toBe('Scan created successfully');
				});

			expect(registerScan.execute).toHaveBeenCalledWith(validBody);
		});
	});
});
