export type StatProps = {
  icon: React.ElementType;
  label: string;
  value: string | number;
};

export const Stat = ({ icon: Icon, label, value }: StatProps) => (
  <div className="flex items-center gap-2">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
      <Icon className="h-4 w-4 text-gray-500" />
    </div>
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  </div>
);
