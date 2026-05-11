export interface GlobalOptions {
  config?: string;
  verbose: boolean;
  output: 'text' | 'json' | 'csv';
}

export interface BuildOptions {
  variant: string;
  static: boolean;
  clean: boolean;
  jobs?: number;
  test: boolean;
}

export interface TestOptions {
  variant: string;
  static: boolean;
}
