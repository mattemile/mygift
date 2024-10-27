'use client';

import clsx from 'clsx';
import { createUrl } from '../../../../lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ListItem, PathFilterItem } from '.';

function PathFilterItem({ item }: { item: PathFilterItem }) {
  const pathname = usePathname();
  const active = pathname === item.path;
  const DynamicTag = active ? 'p' : Link;

  return (
    <li className="mt-2 flex text-black dark:text-white" key={item.title}>
     
    </li>
  );
}

export function FilterItem({ item }: { item: ListItem }) {
  return '';
}
