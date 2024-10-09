module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json'
			}
		]
	},
	projects: [
    {
    testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/lib"],
      preset: "ts-jest",
      displayName: "backend",
	  rootDir: "apps/backend",
	  moduleDirectories: ["node_modules"],
    },
	{
    testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/lib"],
	  preset: "ts-jest",
	  displayName: "crawler",
	  rootDir: "packages/crawler",
	},
	{
    testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/lib"],
	  preset: "ts-jest",
	  displayName: "shared",
	  rootDir: "packages/shared",
	},
	{
    testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/lib"],
	  preset: "ts-jest",
	  displayName: "node-connector",
	  rootDir: "packages/node-connector",
	},
  ],
};