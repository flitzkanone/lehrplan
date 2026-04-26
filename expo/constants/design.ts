import { Platform } from 'react-native';
import Colors from './colors';

/** Consistent border-radius scale used by every screen and component. */
export const RADIUS = {
  xs: 8,
  sm: 10,
  md: 14,   // buttons, chips, small cards
  lg: 20,   // cards, inputs
  xl: 24,   // modals, large cards
  xxl: 32,  // bottom-sheets
  pill: 100, // fully rounded
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  body: {
    fontSize: 15,
    color: Colors.text,
  },
  caption: {
    fontSize: 12,
    color: Colors.textLight,
  },
};

export const Buttons = {
  primary: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 8,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondary: {
    backgroundColor: Colors.inputBg,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 8,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  destructive: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: Colors.negative,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 6,
  },
  destructiveText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  cancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: Colors.inputBg,
    alignItems: 'center' as const,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
};

export const Cards = {
  base: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  bordered: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
};

export const Inputs = {
  container: {
    backgroundColor: Colors.inputBg,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  search: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.inputBg,
    borderRadius: 18,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchText: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
};

export const Chips = {
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  pillTextActive: {
    color: Colors.white,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: Colors.inputBg,
  },
  filterActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  filterTextActive: {
    color: Colors.white,
  },
};

export const Modals = {
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center' as const,
    padding: 28,
  },
  content: {
    backgroundColor: Colors.white,
    borderRadius: 32,
    padding: 24,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
  },
};

export const EmptyState = {
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingTop: 80,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.neutralLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
};

export const IconBox = {
  base: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
