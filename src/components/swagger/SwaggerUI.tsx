'use client';

import { RedocStandalone } from 'redoc';

type Props = {
    spec: Record<string, any>,
};

function ReactSwagger({ spec }: Props) {
    return <RedocStandalone spec={spec}/>
}

export default ReactSwagger;