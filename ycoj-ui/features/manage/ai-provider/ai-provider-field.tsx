import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import { useId } from 'react';
import {
  Controller,
  type Control,
  type FieldPathByValue,
} from 'react-hook-form';

type Props = {
  control: Control<AiProviderConfig>;
  name: FieldPathByValue<AiProviderConfig, string | number | boolean>;
  label: string;
  description?: string;
  options?: { value: string; label: string }[];
  type?: 'text' | 'url' | 'password' | 'number';
  min?: number;
  max?: number;
};

export default function AiProviderField({
  control,
  name,
  label,
  description,
  options,
  type = 'text',
  min,
  max,
}: Props) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="min-w-0">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {options ? (
            <Select
              value={String(field.value)}
              onValueChange={(value) =>
                field.onChange(
                  typeof field.value === 'boolean' ? value === 'true' : value
                )
              }
              disabled={field.disabled}
            >
              <SelectTrigger
                id={id}
                ref={field.ref}
                onBlur={field.onBlur}
                className="w-full min-w-0"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? `${id}-error` : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              {...field}
              id={id}
              value={
                typeof field.value === 'boolean'
                  ? String(field.value)
                  : field.value
              }
              type={type}
              min={min}
              max={max}
              step={type === 'number' ? 1 : undefined}
              autoComplete={type === 'password' ? 'new-password' : undefined}
              onChange={(event) =>
                field.onChange(
                  type === 'number'
                    ? Number(event.target.value)
                    : event.target.value
                )
              }
              aria-invalid={fieldState.invalid}
              aria-describedby={
                fieldState.error
                  ? `${id}-error`
                  : description
                    ? `${id}-description`
                    : undefined
              }
            />
          )}
          {description && (
            <FieldDescription id={`${id}-description`}>
              {description}
            </FieldDescription>
          )}
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
