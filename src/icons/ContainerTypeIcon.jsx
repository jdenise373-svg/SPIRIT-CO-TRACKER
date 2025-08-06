import { WoodenBarrelIcon } from './WoodenBarrelIcon';
import { MetalDrumIcon } from './MetalDrumIcon';
import { SquareTankIcon } from './SquareTankIcon';
import { ToteIcon } from './ToteIcon';
import { FiveGallonToteIcon } from './FiveGallonToteIcon';
import { StillIcon } from './StillIcon';
import { FermenterIcon } from './FermenterIcon';

export const ContainerTypeIcon = ({ type, fillPercentage = 0 }) => {
  const getFillSvgHeight = (maxSvgFillHeightForIcon, percentage) => (maxSvgFillHeightForIcon * Math.min(100, Math.max(0, percentage))) / 100;
  let visualFillableHeight = 80;
  if (type === 'wooden_barrel') visualFillableHeight = 85;
  if (type === 'metal_drum') visualFillableHeight = 95;
  if (type === 'square_tank') visualFillableHeight = 90;
  if (type === 'tote') visualFillableHeight = 100;
  if (type === 'five_gallon_tote') visualFillableHeight = 65;
  if (type === 'still') visualFillableHeight = 50;
  if (type === 'fermenter') return <FermenterIcon fillPercentage={fillPercentage} />;

  const actualFillSvgHeight = getFillSvgHeight(visualFillableHeight, fillPercentage);

  if (type === 'wooden_barrel') return <WoodenBarrelIcon fillSvgHeight={actualFillSvgHeight} />;
  if (type === 'metal_drum') return <MetalDrumIcon fillSvgHeight={actualFillSvgHeight} />;
  if (type === 'square_tank') return <SquareTankIcon fillSvgHeight={actualFillSvgHeight} />;
  if (type === 'tote') return <ToteIcon fillSvgHeight={actualFillSvgHeight} />;
  if (type === 'five_gallon_tote') return <FiveGallonToteIcon fillSvgHeight={actualFillSvgHeight} />;
  if (type === 'still') return <StillIcon fillSvgHeight={actualFillSvgHeight} />;
  return <div className="w-16 h-20 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600">No Icon</div>;
};