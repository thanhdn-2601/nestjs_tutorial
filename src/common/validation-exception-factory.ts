import { UnprocessableEntityException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { I18nContext } from 'nestjs-i18n';

const I18N_MESSAGE_PATTERN = /^([\w.]+)\|(.*)$/;

function translateMessage(message: string, property: string): string {
  const match = I18N_MESSAGE_PATTERN.exec(message);
  if (!match) return message;

  const i18n = I18nContext.current();
  if (!i18n) return message;

  const [, key, rawArgs] = match;
  const args = JSON.parse(rawArgs) as Record<string, unknown>;
  return i18n.translate(key, { args: { property, ...args } });
}

function collectErrors(
  errors: ValidationError[],
  acc: Record<string, string[]>,
): void {
  for (const error of errors) {
    if (error.children?.length) {
      collectErrors(error.children, acc);
      continue;
    }
    if (error.constraints) {
      acc[error.property] = Object.values(error.constraints).map((message) =>
        translateMessage(message, error.property),
      );
    }
  }
}

export function validationExceptionFactory(
  errors: ValidationError[],
): UnprocessableEntityException {
  const formatted: Record<string, string[]> = {};
  collectErrors(errors, formatted);
  return new UnprocessableEntityException({ errors: formatted });
}
