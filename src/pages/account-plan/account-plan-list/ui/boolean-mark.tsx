interface BooleanMarkProps {
  value: boolean
}

/** ✓ для true, — для false. Используется в колонках флагов и в таблице субконто. */
export const BooleanMark = ({ value }: BooleanMarkProps) => (
  <span
    aria-label={value ? 'true' : 'false'}
    className={value ? 'text-ui-06' : 'text-ui-05'}
  >
    {value ? '✓' : '—'}
  </span>
)
