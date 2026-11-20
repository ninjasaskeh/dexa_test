import type { ReactNode } from "react"
import { Controller, type Control, type ControllerRenderProps, type FieldPath, type FieldValues } from "react-hook-form"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

interface FormFieldProps<T extends FieldValues, N extends FieldPath<T>> {
  control: Control<T>
  name: N
  label: string
  description?: ReactNode
  className?: string
  children: (field: ControllerRenderProps<T, N> & { id: string; "aria-invalid": boolean }) => ReactNode
}

/** Pembungkus react-hook-form + shadcn Field: label, input, dan pesan error Zod */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({ control, name, label, description, className, children }: FormFieldProps<T, N>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          {children({ ...field, id: name, "aria-invalid": fieldState.invalid })}
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
