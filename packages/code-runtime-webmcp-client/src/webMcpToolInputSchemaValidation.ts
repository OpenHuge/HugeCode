type JsonRecord = Record<string, unknown>;

export type SchemaValidationResult = {
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  typeMismatches: string[];
  extraFields: string[];
};

type ValidationState = {
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  typeMismatches: string[];
  extraFields: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function describeValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function joinPath(path: string, key: string): string {
  return path.length > 0 ? `${path}.${key}` : key;
}

function addTypeMismatch(state: ValidationState, message: string): void {
  state.typeMismatches.push(message);
  state.errors.push(message);
}

function matchesExpectedType(value: unknown, expectedType: string): boolean {
  if (expectedType === "string") {
    return typeof value === "string";
  }
  if (expectedType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (expectedType === "integer") {
    return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
  }
  if (expectedType === "boolean") {
    return typeof value === "boolean";
  }
  if (expectedType === "array") {
    return Array.isArray(value);
  }
  if (expectedType === "object") {
    return isRecord(value);
  }
  return true;
}

function validateValue(
  value: unknown,
  schema: unknown,
  path: string,
  state: ValidationState,
  allowExtraFields: boolean
): void {
  if (!isRecord(schema)) {
    return;
  }

  const variants = Array.isArray(schema.oneOf) ? schema.oneOf : null;
  if (variants) {
    for (const variant of variants) {
      const branchState: ValidationState = {
        errors: [],
        warnings: [],
        missingRequired: [],
        typeMismatches: [],
        extraFields: [],
      };
      validateValue(value, variant, path, branchState, allowExtraFields);
      if (branchState.errors.length === 0) {
        state.errors.push(...branchState.errors);
        state.warnings.push(...branchState.warnings);
        state.missingRequired.push(...branchState.missingRequired);
        state.typeMismatches.push(...branchState.typeMismatches);
        state.extraFields.push(...branchState.extraFields);
        return;
      }
    }
  }

  const schemaType = typeof schema.type === "string" ? schema.type : null;
  if (schemaType && !matchesExpectedType(value, schemaType)) {
    addTypeMismatch(
      state,
      `${path || "value"} must be of type ${schemaType}, received ${describeValueType(value)}.`
    );
    return;
  }

  if (schemaType === "array" && Array.isArray(value)) {
    const itemSchema = schema.items;
    if (itemSchema !== undefined) {
      value.forEach((item, index) => {
        validateValue(item, itemSchema, `${path}[${index}]`, state, allowExtraFields);
      });
    }
    return;
  }

  if (schemaType === "object" && isRecord(value)) {
    const requiredFields = toStringArray(schema.required);
    const properties = isRecord(schema.properties) ? schema.properties : {};

    for (const field of requiredFields) {
      if (value[field] === undefined) {
        state.missingRequired.push(joinPath(path, field));
        state.errors.push(`${joinPath(path, field)} is required.`);
      }
    }

    for (const [key, nestedSchema] of Object.entries(properties)) {
      if (value[key] === undefined) {
        continue;
      }
      validateValue(value[key], nestedSchema, joinPath(path, key), state, allowExtraFields);
    }

    if (!allowExtraFields) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          state.extraFields.push(joinPath(path, key));
        }
      }
    }
  }
}

export function validateToolInputAgainstSchema(
  input: unknown,
  schema: unknown,
  options: { allowExtraFields?: boolean } = {}
): SchemaValidationResult {
  const state: ValidationState = {
    errors: [],
    warnings: [],
    missingRequired: [],
    typeMismatches: [],
    extraFields: [],
  };
  validateValue(input, schema, "", state, options.allowExtraFields ?? false);
  return {
    errors: state.errors,
    warnings: state.warnings,
    missingRequired: state.missingRequired,
    typeMismatches: state.typeMismatches,
    extraFields: state.extraFields,
  };
}
