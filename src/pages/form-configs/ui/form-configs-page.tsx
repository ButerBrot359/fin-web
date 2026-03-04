import { Typography } from '@mui/material'
import { useParams } from 'react-router-dom'

import { useFormConfig } from '@/entities/form-config'

export const FormConfigsPage = () => {
  const { name = 'example' } = useParams<{ name: string }>()
  const config = useFormConfig(name)

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Typography variant="h5" fontWeight={600}>
        {config.title}
      </Typography>
      <pre className="overflow-auto rounded-lg bg-gray-100 p-4 text-sm">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  )
}
