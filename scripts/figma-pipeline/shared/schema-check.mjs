function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getTypeName(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function matchesSchemaType(value, expectedType) {
  if (Array.isArray(expectedType)) {
    return expectedType.includes(getTypeName(value));
  }
  return getTypeName(value) === expectedType;
}

function validateValue(value, schema, pointer, issues) {
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (schema.type === "object") {
    if (!isObject(value)) {
      issues.push(`${pointer} must be an object.`);
      return;
    }

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in value)) {
        issues.push(`${pointer} is missing required key "${key}".`);
      }
    }

    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (!(key in value)) {
        continue;
      }
      validateValue(value[key], childSchema, `${pointer}.${key}`, issues);
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(properties));
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          issues.push(`${pointer}.${key} is not allowed by the schema.`);
        }
      }
    }

    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      issues.push(`${pointer} must be an array.`);
      return;
    }
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      issues.push(`${pointer} must contain at least ${schema.minItems} item(s).`);
    }
    if (schema.items) {
      value.forEach((entry, index) => {
        validateValue(entry, schema.items, `${pointer}[${index}]`, issues);
      });
    }
    return;
  }

  if (schema.type === "integer") {
    if (!Number.isInteger(value)) {
      issues.push(`${pointer} must be of type integer.`);
      return;
    }
  } else if (schema.type && !matchesSchemaType(value, schema.type)) {
    const expected = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
    issues.push(`${pointer} must be of type ${expected}.`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    issues.push(`${pointer} must be one of: ${schema.enum.join(", ")}.`);
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      issues.push(`${pointer} must be >= ${schema.minimum}.`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      issues.push(`${pointer} must be <= ${schema.maximum}.`);
    }
  }
}

export function validateAgainstSchema(payload, schema) {
  const issues = [];
  validateValue(payload, schema, "$", issues);
  return issues;
}
