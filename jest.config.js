module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testEnvironment: 'jsdom',
  
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/backend/'
  ],
  
  coverageDirectory: '<rootDir>/coverage',
  
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/*.routes.ts',
    '!src/main.ts',
    '!src/environments/**',
    '!src/setup-jest.ts',
    '!src/**/*.d.ts'
  ],
  
  coverageReporters: ['html', 'text', 'lcov', 'json'],
  
  moduleNameMapper: {
    '@app/(.*)': '<rootDir>/src/app/$1',
    '@environments/(.*)': '<rootDir>/src/environments/$1',
    '@services/(.*)': '<rootDir>/src/app/services/$1',
    '@shared/(.*)': '<rootDir>/src/app/shared/$1',
    '@guards/(.*)': '<rootDir>/src/app/guards/$1',
    '@interceptors/(.*)': '<rootDir>/src/app/interceptors/$1',
    // Para CSS/SCSS
    '\\.(css|less|scss|sass)$': 'jest-transform-stub',
    // Para imágenes y otros assets
    '\\.(jpg|jpeg|png|gif|svg|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
  },
  
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.html$',
        isolatedModules: true
      }
    ]
  },
  
  transformIgnorePatterns: [
    'node_modules/(?!(@angular|@ngrx|rxjs|tslib|chart.js)/)'
  ],
  
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  
  // REMOVE the globals section as it's deprecated
  // globals: {
  //   'ts-jest': {
  //     tsconfig: '<rootDir>/tsconfig.spec.json',
  //     stringifyContentPathRegex: '\\.(html|svg)$'
  //   }
  // },
  
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment'
  ],
  
  // Timeout para tests lentos
  testTimeout: 10000,
  
  // Para debugging
  verbose: true,
  
  // Cache para mejorar performance
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache'
};