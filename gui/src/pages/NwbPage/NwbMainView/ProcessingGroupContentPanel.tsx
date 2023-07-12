import { FunctionComponent, useEffect, useMemo, useReducer, useState } from "react"
import Hyperlink from "../../../components/Hyperlink"
import '../nwb-table.css'
import Abbreviate from "../NwbAcquisitionItemView/Abbreviate"
import { useNwbOpenTabs } from "../NwbOpenTabsContext"
import { RemoteH5File, RemoteH5Group } from "../RemoteH5File/RemoteH5File"
import { useSelectedNwbItems } from "../SelectedNwbItemsContext"
import { useGroup } from "./NwbMainView"

type Props = {
    nwbFile: RemoteH5File
    groupPath: string
}

type LoadedGroups = {
    loaded: {[path: string]: RemoteH5Group}
    requestedPaths: string[]
}
type LoadedGroupsAction = {
    type: 'set'
    path: string
    group: RemoteH5Group
} | {
    type: 'request'
    path: string
}
const loadedGroupsReducer = (state: LoadedGroups, action: LoadedGroupsAction) => {
    if (action.type === 'set') {
        const loaded = {...state.loaded}
        loaded[action.path] = action.group
        return {
            loaded,
            requestedPaths: state.requestedPaths.filter(p => (p !== action.path))
        }
    }
    else if (action.type === 'request') {
        if (state.loaded[action.path]) return state
        if (state.requestedPaths.includes(action.path)) return state
        return {
            loaded: state.loaded,
            requestedPaths: [...state.requestedPaths, action.path]
        }
    }
    else return state
}

const ProcessingGroupContentPanel: FunctionComponent<Props> = ({nwbFile, groupPath}) => {
    const group = useGroup(nwbFile, groupPath)
    const [loadedGroups, dispatchLoadedGroups] = useReducer(loadedGroupsReducer, {loaded: {}, requestedPaths: []})
    const {selectedNwbItemPaths, toggleSelectedNwbItem} = useSelectedNwbItems()
    useEffect(() => {
        const load = async () => {
            for (const p of loadedGroups.requestedPaths) {
                const g = await nwbFile.getGroup(p)
                dispatchLoadedGroups({type: 'set', path: p, group: g})
            }
        }
        load()
    }, [loadedGroups.requestedPaths, nwbFile])
    const tableItems = useMemo(() => {
        const ret: {name: string, path: string}[] = []
        if (group) {
            for (const subgroup of group.subgroups) {
                // Hard-code the containers (handle this in a better way in the future)
                // From Ben:
                // LFP holds ElectricalSeries
                // Fluorescence holds RoiResponseSeries
                // DFOverF holds RoiResponseSeries
                // BehavioralTimeSeries holds TimeSeries
                // EyeTracking holds SpatialSeries
                // Position holds SpatialSeries
                if (['LFP', 'Fluorescence', 'DfOverF', 'BehavioralTimeSeries', 'EyeTracking', 'Position', 'ImageSegmentation', 'PupilTracking', 'CompassDirection'].includes(subgroup.attrs['neurodata_type'])) {
                    const gg = loadedGroups.loaded[subgroup.path]
                    if (gg) {
                        for (const subsubgroup of gg.subgroups) {
                            ret.push({
                                name: subgroup.name + '/' + subsubgroup.name,
                                path: subsubgroup.path
                            })
                        }
                    }
                    else {
                        dispatchLoadedGroups({type: 'request', path: subgroup.path})
                    }
                }
                else {
                    ret.push({
                        name: subgroup.name,
                        path: subgroup.path
                    })
                }
            }
        }
        return ret
    }, [group, loadedGroups.loaded])
    if (!group) return <div>...</div>
    return (
        <div>
            <table className="nwb-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Item</th>
                        <th>Neurodata type</th>
                        <th>Description</th>
                        <th>Comments</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        tableItems.map((tableItem) => (
                            <GroupTableRow
                                key={tableItem.name}
                                name={tableItem.name}
                                nwbFile={nwbFile}
                                path={tableItem.path}
                                selected={selectedNwbItemPaths.includes(tableItem.path)}
                                onToggleSelect={(neurodataType) => toggleSelectedNwbItem(tableItem.path, neurodataType)}
                            />
                        ))
                    }
                </tbody>
            </table>
        </div>
    )
}

type GroupTableRowProps = {
    name: string,
    nwbFile: RemoteH5File
    path: string
    selected: boolean
    onToggleSelect: (neurodataType: string) => void
}

const GroupTableRow: FunctionComponent<GroupTableRowProps> = ({nwbFile, name, path, selected, onToggleSelect}) => {
    const [group, setGroup] = useState<RemoteH5Group | undefined>(undefined)
    useEffect(() => {
        let canceled = false
        const load = async () => {
            const g = await nwbFile.getGroup(path)
            if (canceled) return
            setGroup(g)
        }
        load()
        return () => {canceled = true}
    }, [nwbFile, path])
    const {openTab} = useNwbOpenTabs()
    const neurodataType = group ? group.attrs['neurodata_type'] : ''
    return (
        <tr>
            <td>
            <input type="checkbox" checked={selected} disabled={!neurodataType} onClick={() => onToggleSelect(neurodataType)} onChange={() => {}} />
            </td>
            <td>
                <Hyperlink disabled={!neurodataType} onClick={() => openTab(`neurodata-item:${path}|${neurodataType}`)}>{name}</Hyperlink>
            </td>
            <td>{group ? group.attrs['neurodata_type'] : ''}</td>
            <td>{group ? group.attrs['description'] : ''}</td>
            <td>{group ? <Abbreviate>{group.attrs['comments']}</Abbreviate> : ''}</td>
        </tr>
    )
}

export default ProcessingGroupContentPanel
