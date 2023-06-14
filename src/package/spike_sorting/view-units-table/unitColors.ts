let offset = 0 // so that we change which is the 0th unit
let stride = 1
let num: number | undefined = undefined // so that we change the periodicity

export const getUnitColor = (unitId: any) => {
    if (num === undefined) num = colors.length
    const i = (offset + unitId * stride) % num
    return colors[i]
}

export const redistributeUnitColors = () => {
    if (num === undefined) num = colors.length
    offset += 1 // so that we change which is the 0th unit
    num -= 1 // so that we change the periodicity
    if (num < colors.length - 6) {
        num = colors.length // but don't let it get too low
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
        stride += 1
        if (isRelativelyPrime(stride, num)) {
            break
        }
    }
}

const isRelativelyPrime = (a: number, b: number) => {
    for (let i = 2; i <= a; i++) {
        if ((a % i === 0) && (b % i === 0)) {
            return false
        }
    }
    return true
}

// Generated by Alessio using distinctipy
const colors: string[] = [
    '#00ff00',
    '#ff00ff',
    '#0080ff',
    '#ff8000',
    '#80bf80',
    '#470ba7',
    '#c80b32',
    '#fd7ee5',
    '#027d30',
    // '#f0fd23',
    '#00ffff',
    '#00ff80',
    '#9c5a86',
    '#808000',
    '#8ed7fa',
    '#80ff00',
    '#6e52ff',
    '#0000ff',
    '#119c9b',
    '#feb982',
    '#56333d',
    '#fb2b97',
    '#8000ff',
    '#c3f1a2',
    '#b3bd25',
    '#45bc2d',
    '#1c4b88',
    '#49f3c0',
    '#a90c9c',
    '#c436ea',
    '#13055b',
    '#7f93d0',
    '#c4552d',
    '#ee7381',
    '#800000',
    '#58fe60',
    '#4f825e',
    '#21bde8',
    '#d7b8e0',
    '#1e40ee',
    '#324a01',
    '#fc2b03',
    '#723cb9',
    '#3a6ac1',
    '#aef14e',
    '#14c568',
    '#bd9c9b',
    '#f9c506',
    '#b579fa',
    // '#ffff80',
    '#810e5e',
    '#b38d4d',
    '#854810',
    '#02ea3a',
    '#0b3b3c',
    '#f90161',
    '#07c304',
    '#fe4c54',
    '#be02ea',
    '#0521bb',
    '#338b05',
    '#4989ff',
    '#52b8b3',
    '#be3271',
    '#f1a441',
    '#0b776b',
    '#0ccfac',
    '#cd61bd',
    '#85fc95',
    '#fe43fe',
    '#bd810d',
    '#cce9e6',
    '#644179',
    '#fedfbe',
    '#80bd00',
    '#99c4bd',
    '#48e5fa',
    '#400626',
    '#bcfc01',
    '#866b3f',
    '#5422e9',
    '#ea03bd',
    '#69809a',
    '#bfca76',
    '#40e60e',
    '#f1da52',
    '#3d5f3b',
    '#63b3f8',
    '#7cd83d',
    '#b52f02',
    '#9364ca',
    '#80a740',
    '#3ce183',
    '#a6a9f6',
    '#fba2bb',
    '#e3763f',
    '#ae3cae',
    '#91414a',
    '#1e94cf',
    '#06f6c9'
]