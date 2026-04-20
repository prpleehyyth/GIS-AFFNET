declare module 'react-leaflet-cluster' {
  import { FC, ReactNode } from 'react';
  import { MarkerClusterGroupOptions } from 'leaflet';
  import { LayerGroupProps } from 'react-leaflet';

  interface Props extends MarkerClusterGroupOptions, LayerGroupProps {
    children: ReactNode;
    chunkedLoading?: boolean;
  }

  const MarkerClusterGroup: FC<Props>;
  export default MarkerClusterGroup;
}