export interface FormConfigFieldOption {
  value: string
  label: string
}

export interface FormConfigField {
  key: string
  type: string
  label: string
  required?: boolean
  options?: FormConfigFieldOption[]
}

export interface FormConfig {
  name: string
  title: string
  fields: FormConfigField[]
}
