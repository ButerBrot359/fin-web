import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import { useTabMeta } from '@/features/workspace-tabs'
import {
  useDictionaryPermissions,
  useUpdateDictionaryPermission,
} from '@/entities/analytics/lib/hooks/use-dictionary-permissions'
import type { AnalyticsDictionaryPermission } from '@/entities/analytics/types/dictionary-permissions'
import { useDictionaryPermissionsCopy } from '../lib/copy'

function PermissionRow({ item }: { item: AnalyticsDictionaryPermission }) {
  const { copy, isKz } = useDictionaryPermissionsCopy()
  const mutation = useUpdateDictionaryPermission()
  const name =
    (isKz ? item.nameKz : item.nameRu) ||
    item.nameRu ||
    item.nameKz ||
    item.typeCode
  const other = isKz ? item.nameRu : item.nameKz
  return (
    <Box
      data-testid={`dictionary-permission-${item.typeCode}`}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: { xs: 1.5, md: 3 },
        py: 2,
        bgcolor: item.allowed ? 'action.hover' : 'transparent',
      }}
    >
      <FormControlLabel
        sx={{ m: 0, alignItems: 'flex-start', flex: 1, minWidth: 0 }}
        control={
          <Checkbox
            checked={item.allowed}
            disabled={mutation.isPending}
            onChange={(_, checked) => {
              mutation.update(item.typeCode, checked)
            }}
            slotProps={{ input: { 'aria-label': `${copy.allowed}: ${name}` } }}
            sx={{ mt: -0.5, mr: 0.5 }}
          />
        }
        label={
          <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <Typography fontWeight={600} sx={{ lineHeight: 1.6 }}>
              {name}
            </Typography>
            {other && other !== name && (
              <Typography variant="body2" color="text.secondary">
                {other}
              </Typography>
            )}
            <Typography
              component="code"
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.5,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {item.typeCode}
            </Typography>
            {mutation.isError && (
              <Box role="alert" sx={{ mt: 1 }}>
                <Typography variant="caption" color="error">
                  {copy.saveError}
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    mutation.update(item.typeCode, !item.allowed)
                  }}
                >
                  {copy.retry}
                </Button>
              </Box>
            )}
          </Box>
        }
      />
      <Box
        sx={{
          width: { xs: 22, sm: 110 },
          flexShrink: 0,
          textAlign: 'right',
          pt: 0.25,
        }}
        aria-live="polite"
      >
        {mutation.isPending ? (
          <CircularProgress size={18} aria-label={copy.saving} />
        ) : mutation.isSuccess ? (
          <Box title={copy.saved}>
            <Box
              component="span"
              sx={{
                display: { xs: 'inline', sm: 'none' },
                color: 'success.main',
              }}
              aria-label={copy.saved}
            >
              ✓
            </Box>
            <Typography
              variant="caption"
              color="success.main"
              sx={{ display: { xs: 'none', sm: 'inline' } }}
            >
              {copy.saved}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
export function AnalyticsDictionaryPermissionsPage() {
  const { copy } = useDictionaryPermissionsCopy()
  const { pageCode } = useParams()
  const navigate = useNavigate()
  useTabMeta(copy.title)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const query = useDictionaryPermissions(search.trim(), page)
  const data = query.data
  const pageCount = Math.max(1, Math.ceil((data?.totalElements ?? 0) / 50))
  return (
    <Box
      data-testid="dictionary-permissions-page"
      sx={{ maxWidth: 1080, mx: 'auto', py: 3, minWidth: 0, width: '100%' }}
    >
      <Button
        size="small"
        onClick={() => {
          void navigate(
            pageCode
              ? `/modules/${pageCode}/analytics/settings`
              : '/analytics/settings'
          )
        }}
        sx={{ mb: 2 }}
      >
        ← {copy.back}
      </Button>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          fontSize: { xs: 25, md: 32 },
          mb: 1,
          overflowWrap: 'anywhere',
        }}
      >
        {copy.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
        {copy.subtitle}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          display: { xs: 'none', md: 'block' },
          p: 3,
          mb: 3,
          borderRadius: 3,
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
          {copy.policy}
        </Typography>
        {data && (
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
            {copy.limits(data.maxValuesPerDictionary, data.maxValueLength)}
          </Typography>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1 }}
        >
          {copy.defaultOff}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1 }}
        >
          {copy.revocation}
        </Typography>
      </Paper>
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          display: { xs: 'block', md: 'none' },
          mb: 2,
          border: 1,
          borderColor: 'divider',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {copy.details}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.shortPolicy}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            {copy.policy}
          </Typography>
          {data && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
              {copy.limits(data.maxValuesPerDictionary, data.maxValueLength)}
            </Typography>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1 }}
          >
            {copy.defaultOff}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1 }}
          >
            {copy.revocation}
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <TextField
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder={copy.search}
            size="small"
            sx={{ flex: '1 1 320px' }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: {
                'aria-label': copy.search,
                'data-testid': 'dictionary-permission-search',
              },
            }}
          />
          {data && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                color="primary"
                variant="outlined"
                label={`${copy.allowed}: ${String(data.allowedCount)}`}
              />
              <Chip
                variant="outlined"
                label={`${search.trim() ? copy.found : copy.total}: ${String(data.totalElements)}`}
              />
            </Box>
          )}
        </Box>
        <Divider />
        {query.isError ? (
          <Alert
            severity="error"
            action={
              <Button
                onClick={() => {
                  void query.refetch()
                }}
              >
                {copy.retry}
              </Button>
            }
          >
            {copy.loadError}
          </Alert>
        ) : query.isLoading ? (
          <Box sx={{ p: 3 }}>
            {[1, 2, 3, 4, 5].map((id) => (
              <Skeleton key={id} height={64} />
            ))}
          </Box>
        ) : data?.items.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography fontWeight={600}>{copy.empty}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {copy.emptyHint}
            </Typography>
            {search && (
              <Button
                onClick={() => {
                  setSearch('')
                  setPage(0)
                }}
                sx={{ mt: 2 }}
              >
                {copy.clear}
              </Button>
            )}
          </Box>
        ) : (
          data?.items.map((item) => (
            <Box key={`${String(query.ownerId)}:${item.typeCode}`}>
              <PermissionRow item={item} />
              <Divider />
            </Box>
          ))
        )}
        <Box
          sx={{
            px: { xs: 1, md: 3 },
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {copy.page(page + 1, pageCount)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              data-testid="dictionary-permission-prev"
              size="small"
              disabled={page === 0 || query.isFetching}
              onClick={() => {
                setPage(page - 1)
              }}
              aria-label={copy.previous}
            >
              ←
            </Button>
            <Button
              data-testid="dictionary-permission-next"
              size="small"
              disabled={page + 1 >= pageCount || query.isFetching}
              onClick={() => {
                setPage(page + 1)
              }}
              aria-label={copy.next}
            >
              →
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
