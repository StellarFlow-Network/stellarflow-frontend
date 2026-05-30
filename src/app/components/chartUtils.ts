export function compressTelemetryStream<T>(data: T[], maxPoints = 50): T[] {
  if (data.length <= maxPoints) {
    return data
  }

  if (maxPoints <= 0) {
    return []
  }

  const step = Math.ceil(data.length / maxPoints)
  const compressed: T[] = []

  for (let index = 0; index < data.length; index += step) {
    compressed.push(data[index])
  }

  const lastPoint = data[data.length - 1]
  if (compressed[compressed.length - 1] !== lastPoint) {
    compressed.push(lastPoint)
  }

  return compressed.slice(0, maxPoints)
}

export function compressTelemetryPairs<LabelType, ValueType>(
  labels: LabelType[],
  values: ValueType[],
  maxPoints = 50,
) {
  if (labels.length !== values.length) {
    const minLength = Math.min(labels.length, values.length)
    labels = labels.slice(0, minLength)
    values = values.slice(0, minLength)
  }

  if (labels.length <= maxPoints) {
    return { labels, values }
  }

  const step = Math.ceil(labels.length / maxPoints)
  const compressedLabels: LabelType[] = []
  const compressedValues: ValueType[] = []

  for (let index = 0; index < labels.length; index += step) {
    compressedLabels.push(labels[index])
    compressedValues.push(values[index])
  }

  const lastIndex = labels.length - 1
  const lastLabel = labels[lastIndex]
  const lastValue = values[lastIndex]

  if (compressedLabels[compressedLabels.length - 1] !== lastLabel) {
    compressedLabels.push(lastLabel)
    compressedValues.push(lastValue)
  }

  return {
    labels: compressedLabels.slice(0, maxPoints),
    values: compressedValues.slice(0, maxPoints),
  }
}
