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
  addLabel?: string
}

export function PhotoUploadField({ files, onChange, disabled = false, maxFiles = MAX_PHOTOS, addLabel }: PhotoUploadFieldProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const previewUrls = useRef<string[]>([])
  const canAddMore = !disabled && files.length < maxFiles

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
      <div className={`photo-dropzone ${canAddMore ? '' : 'is-disabled'}`}>
        <input
          id={inputId}
          type="file"
          autoComplete="off"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={!canAddMore}
          onChange={(event) => {
            addFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        {canAddMore ? (
          <label className="photo-dropzone-prompt" htmlFor={inputId}>
            <span className="photo-upload-icon" aria-hidden="true">＋</span>
            <span>
              <strong>{t(files.length > 0 ? 'addMorePhotos' : addLabel ?? 'addPhotos')}</strong>
              <small>{files.length > 0 ? t('photosSelected', { count: files.length }) : t('photoUploadHelp', { count: maxFiles - files.length })}</small>
            </span>
          </label>
        ) : files.length > 0 ? (
          <span className="photo-dropzone-prompt">
            <span className="photo-upload-icon" aria-hidden="true">✓</span>
            <span><strong>{t('photosSelected', { count: files.length })}</strong></span>
          </span>
        ) : null}
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
                <small className="photo-filename" title={files[index].name}>{files[index].name}</small>
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
