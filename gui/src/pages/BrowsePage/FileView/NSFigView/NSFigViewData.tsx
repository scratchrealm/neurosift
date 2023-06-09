import validateObject, { isArrayOf, isBoolean, isEqualTo, isNumber, isOneOf, isString, optional } from "../../../../types/validateObject"

export type NSFigLayoutItem = {
    stretch?: number
    minSize?: number
    maxSize?: number
    title?: string
    collapsible?: boolean
    view: string | NSFigLayout
}

const isNSFigLayoutItem = (x: any): x is NSFigLayoutItem => {
    return validateObject(x, {
        stretch: optional(isNumber),
        minSize: optional(isNumber),
        maxSize: optional(isNumber),
        title: optional(isString),
        collapsible: optional(isOneOf([isEqualTo(true), isEqualTo(false)])),
        view: isOneOf([isString, isNSFigLayout])
    })
}

export type NSFigLayout = {
    type: 'Box'
    direction: 'horizontal' | 'vertical'
    items: NSFigLayoutItem[]
    scrollbar?: boolean
    showTitles?: boolean
    editNSFigMode?: boolean
} | {
    type: 'Splitter'
    direction: 'horizontal' | 'vertical'
    item1: NSFigLayoutItem
    item2: NSFigLayoutItem
    editNSFigMode?: boolean
}

const isNSFigLayout = (x: any): x is NSFigLayout => {
    if (validateObject(x, {
        type: isEqualTo('Box'),
        direction: isOneOf([isEqualTo('horizontal'), isEqualTo('vertical')]),
        items: isArrayOf(isNSFigLayoutItem),
        scrollbar: optional(isBoolean),
        showTitles: optional(isBoolean),
        editNSFigMode: optional(isBoolean)
    })) return true

    if (validateObject(x, {
        type: isEqualTo('Splitter'),
        direction: isOneOf([isEqualTo('horizontal'), isEqualTo('vertical')]),
        item1: isNSFigLayoutItem,
        item2: isNSFigLayoutItem,
        editNSFigMode: optional(isBoolean)
    })) return true

    return false
}

export type NSFigViewItem = {
    name: string
    type: 'TimeseriesGraph'
    data: string
    annotation?: string
} | {
    name: string
    type: 'TimeseriesGraph2'
    data: string
    annotation?: string
} | {
    name: string
    type: 'AnnotatedVideo'
    data: string
    annotation?: string
    position_decode_field?: string
} | {
    name: string
    type: 'AudioSpectrogram'
    data: string
    annotation?: string
} | {
    name: string
    type: 'RasterPlot'
    data: string
} | {
    name: string
    type: 'EditNSFigViewItem'
    view: NSFigViewItem
} | {
    name: string
    type: 'Autocorrelograms'
    data: string
} | {
    name: string
    type: 'AverageWaveforms'
    data: string
}

const isNSFigViewItem = (x: any): x is NSFigViewItem => {
    if (validateObject(x, {
        name: isString,
        type: isEqualTo('TimeseriesGraph'),
        data: isString,
        annotation: optional(isString)
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('TimeseriesGraph2'),
        data: isString,
        annotation: optional(isString)
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('AnnotatedVideo'),
        data: isString,
        annotation: optional(isString)
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('AudioSpectrogram'),
        data: isString,
        annotation: optional(isString)
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('RasterPlot'),
        data: isString
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('EditNSFigViewItem'),
        view: isNSFigViewItem
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('Autocorrelograms'),
        data: isString
    })) return true

    if (validateObject(x, {
        name: isString,
        type: isEqualTo('AverageWaveforms'),
        data: isString
    })) return true

    return false
}

export type NSFigViewData = {
    type: 'neurosift_figure'
    version: 'v1'
    layout: NSFigLayout
    views: NSFigViewItem[]
}

export const isNSFigViewData = (x: any): x is NSFigViewData => {
    return validateObject(x, {
        type: isEqualTo('neurosift_figure'),
        version: isEqualTo('v1'),
        layout: isNSFigLayout,
        views: isArrayOf(isNSFigViewItem)
    })
}