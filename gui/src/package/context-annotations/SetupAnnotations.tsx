import { FunctionComponent, PropsWithChildren } from "react";

const SetupAnnotations: FunctionComponent<PropsWithChildren> = (props) => {
	// const [annotationState, annotationDispatch] = useReducer(annotationReducer, defaultAnnotationState)
    // const value = useMemo(() => ({annotationState, annotationDispatch}), [annotationState, annotationDispatch])
	// const {urlState} = useUrlState()
	// const first = useRef<boolean>(true)
	// useEffect(() => {
	// 	if (!first.current) return
	// 	const uri = urlState.annotations
	// 	if (uri) {
	// 		getFileData(uri, () => {}).then((x) => {
	// 			annotationDispatch({type: 'setAnnotationState', annotationState: x})
	// 		}).catch((err: Error) => {
	// 			console.warn('Problem getting annotation state')
	// 			console.warn(err)
	// 		})
	// 	}
	// 	first.current = false
	// }, [urlState.annotations, first])
    // return (
    //     <AnnotationsContext.Provider value={value}>
    //         {props.children}
    //     </AnnotationsContext.Provider>
    // )
	return <>{props.children}</>
}

export default SetupAnnotations
