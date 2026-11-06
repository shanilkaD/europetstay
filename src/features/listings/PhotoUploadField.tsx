import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_PHOTOS = 6
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

type PhotoUploadFieldProps = {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
  maxFiles?: number
}

export function PhotoUploadField({ files, onChange, disabled = false, maxFiles = MAX_PHOTOS }: PhotoUploadFieldProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const previewUrls = useRef<string[]>([])

  useEffect(() => {
    return () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const selected = Array.from(fileList)
    const invalidType = selected.find((file) => !ACCEPTED_TYPES.has(file.type))
    if (invalidType) {
      setError(t('photoTypeError'))
      return
    }
    if (selected.some((file) => file.size > MAX_PHOTO_BYTES)) {
      setError(t('photoSizeError'))
      return
    }
    if (files.length + selected.length > maxFiles) {
      setError(t('photoCountError', { count: maxFiles }))
      return
    }
    setError('')
    previewUrls.current = [...previewUrls.current, ...selected.map((file) => URL.createObjectURL(file))]
    setPreviews(previewUrls.current)
    onChange([...files, ...selected])
  }

  function removeFile(index: number) {
    setError('')
    URL.revokeObjectURL(previewUrls.current[index])
    previewUrls.current = previewUrls.current.filter((_, fileIndex) => fileIndex !== index)
    setPreviews(previewUrls.current)
    onChange(files.filter((_, fileIndex) => fileIndex !== index))
  }

  return (
    <div className="photo-upload">
      <div className={`photo-dropzone ${disabled ? 'is-disabled' : ''}`}>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={disabled || files.length >= maxFiles}
          onChange={(event) => {
            addFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        <label className="photo-dropzone-prompt" htmlFor={inputId}>
          <span className="photo-upload-icon" aria-hidden="true">＋</span>
          <span><strong>{t('addPhotos')}</strong><small>{t('photoUploadHelp', { count: maxFiles - files.length })}</small></span>
        </label>
        {previews.length > 0 && (
          <div className="photo-preview-grid is-inline">
          {previews.map((preview, index) => (
            <div className="photo-preview" key={`${files[index].name}-${files[index].lastModified}`}>
              <img src={preview} alt={t('photoPreview', { number: index + 1 })} />
              <button
                type="button"
                aria-label={t('removePhoto', { number: index + 1 })}
                disabled={disabled}
                onClick={() => removeFile(index)}
              >×</button>
            </div>
          ))}
          </div>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
