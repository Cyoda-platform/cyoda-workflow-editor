export class SchemaError extends Error {
  constructor(message: string, public readonly path?: (string | number)[]) {
    super(message);
    this.name = "SchemaError";
  }
}

export class ParseJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseJsonError";
  }
}
