import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, FileText, FileSpreadsheet, FileJson, Check } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import XLSX from 'xlsx';
import { UI } from '@/constants/ui';
import Colors from '@/constants/colors';
import AppButton from '@/components/ui/AppButton';
import { useApp } from '@/context/AppContext';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
}

type ExportFormat = 'pdf' | 'excel' | 'csv';

export default function ExportModal({ visible, onClose }: ExportModalProps) {
  const { data } = useApp();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const toggleClass = (id: string) => {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleSubject = (sub: string) => {
    setSelectedSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Filter data
      const filteredClasses = data.classes.filter(c => 
        selectedClasses.length === 0 || selectedClasses.includes(c.id)
      );
      const classIds = filteredClasses.map(c => c.id);

      const filteredParticipations = data.participations.filter(p => 
        classIds.includes(p.classId) && 
        (selectedSubjects.length === 0 || selectedSubjects.includes(p.subject))
      );

      const filteredHomework = data.homeworkEntries.filter(h => 
        classIds.includes(h.classId) && 
        (selectedSubjects.length === 0 || selectedSubjects.includes(h.subject))
      );

      if (format === 'csv') {
        await exportCSV(filteredClasses, filteredParticipations);
      } else if (format === 'excel') {
        await exportExcel(filteredClasses, filteredParticipations, filteredHomework);
      } else if (format === 'pdf') {
        await exportPDF(filteredClasses, filteredParticipations, filteredHomework);
      }

      onClose();
    } catch (e) {
      console.error('[ExportModal] Error exporting:', e);
      Alert.alert('Fehler', 'Der Export ist fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCSV = async (classes: any[], participations: any[]) => {
    let csv = 'Klasse,Schüler ID,Vorname,Nachname,Teilnahmen\n';
    
    classes.forEach(cls => {
      cls.students.forEach((student: any) => {
        const studentParticipations = participations.filter(
          p => p.classId === cls.id && p.studentId === student.id
        ).length;
        
        csv += `"${cls.name}","${student.id}","${student.firstName}","${student.lastName}",${studentParticipations}\n`;
      });
    });

    const fileUri = FileSystem.documentDirectory + 'Rork_Export.csv';
    await FileSystem.writeAsStringAsync(fileUri, csv);
    await shareFile(fileUri, 'text/csv');
  };

  const exportExcel = async (classes: any[], participations: any[], homework: any[]) => {
    const wb = XLSX.utils.book_new();

    // Participations Sheet
    const partData = participations.map(p => {
      const cls = classes.find(c => c.id === p.classId);
      const student = cls?.students.find((s: any) => s.id === p.studentId);
      return {
        'Datum': new Date(p.date).toLocaleDateString(),
        'Klasse': cls?.name || 'Unbekannt',
        'Fach': p.subject,
        'Name': student ? `${student.firstName} ${student.lastName}` : 'Unbekannt',
        'Mitarbeit': p.rating,
        'Grund': p.reason || '',
      };
    });
    
    if (partData.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(partData);
      XLSX.utils.book_append_sheet(wb, ws1, "Mitarbeit");
    }

    // Homework Sheet
    const hwData = homework.map(h => {
      const cls = classes.find(c => c.id === h.classId);
      const student = cls?.students.find((s: any) => s.id === h.studentId);
      return {
        'Datum': new Date(h.date).toLocaleDateString(),
        'Klasse': cls?.name || 'Unbekannt',
        'Fach': h.subject,
        'Name': student ? `${student.firstName} ${student.lastName}` : 'Unbekannt',
        'Status': h.status,
      };
    });

    if (hwData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(hwData);
      XLSX.utils.book_append_sheet(wb, ws2, "Hausaufgaben");
    }

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileUri = FileSystem.documentDirectory + 'Rork_Export.xlsx';
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await shareFile(fileUri, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const exportPDF = async (classes: any[], participations: any[], homework: any[]) => {
    let html = `
      <html>
        <head>
          <style>
            body { font-family: -apple-system, sans-serif; color: #1c1c1e; padding: 20px; }
            h1 { color: #0A7EA4; }
            h2 { margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f7; }
          </style>
        </head>
        <body>
          <h1>Rork Lehrer App Export</h1>
          <p>Datum: ${new Date().toLocaleDateString()}</p>
    `;

    classes.forEach(cls => {
      html += `<h2>Klasse: ${cls.name}</h2>`;
      const classParts = participations.filter(p => p.classId === cls.id);
      
      if (classParts.length > 0) {
        html += `
          <h3>Mitarbeit</h3>
          <table>
            <tr><th>Datum</th><th>Fach</th><th>Schüler</th><th>Note</th></tr>
        `;
        classParts.forEach(p => {
          const student = cls.students.find((s: any) => s.id === p.studentId);
          html += `<tr>
            <td>${new Date(p.date).toLocaleDateString()}</td>
            <td>${p.subject}</td>
            <td>${student ? student.firstName + ' ' + student.lastName : '-'}</td>
            <td>${p.rating} ${p.reason ? `(${p.reason})` : ''}</td>
          </tr>`;
        });
        html += `</table>`;
      } else {
        html += `<p>Keine Mitarbeitseinträge.</p>`;
      }
    });

    html += `</body></html>`;

    const { uri } = await Print.printToFileAsync({ html });
    await shareFile(uri, 'application/pdf');
  };

  const shareFile = async (uri: string, mimeType: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Daten exportieren' });
    } else {
      Alert.alert('Fehler', 'Teilen ist auf diesem Gerät nicht verfügbar.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <BlurView intensity={20} style={StyleSheet.absoluteFill} />
      
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Daten exportieren</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea}>
            <Text style={styles.sectionTitle}>Format wählen</Text>
            <View style={styles.formatRow}>
              <TouchableOpacity
                style={[styles.formatCard, format === 'pdf' && styles.formatCardActive]}
                onPress={() => setFormat('pdf')}
              >
                <FileText size={24} color={format === 'pdf' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.formatText, format === 'pdf' && styles.formatTextActive]}>PDF</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.formatCard, format === 'excel' && styles.formatCardActive]}
                onPress={() => setFormat('excel')}
              >
                <FileSpreadsheet size={24} color={format === 'excel' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.formatText, format === 'excel' && styles.formatTextActive]}>Excel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formatCard, format === 'csv' && styles.formatCardActive]}
                onPress={() => setFormat('csv')}
              >
                <FileJson size={24} color={format === 'csv' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.formatText, format === 'csv' && styles.formatTextActive]}>CSV</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Klassen (leer = alle)</Text>
            <View style={styles.chipContainer}>
              {data.classes.map(cls => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.chip, selectedClasses.includes(cls.id) && styles.chipActive]}
                  onPress={() => toggleClass(cls.id)}
                >
                  <Text style={[styles.chipText, selectedClasses.includes(cls.id) && styles.chipTextActive]}>
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Fächer (leer = alle)</Text>
            <View style={styles.chipContainer}>
              {data.profile.subjects.map(sub => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.chip, selectedSubjects.includes(sub) && styles.chipActive]}
                  onPress={() => toggleSubject(sub)}
                >
                  <Text style={[styles.chipText, selectedSubjects.includes(sub) && styles.chipTextActive]}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label={isExporting ? "Exportiere..." : "Export starten"}
              onPress={handleExport}
              disabled={isExporting}
              leftIcon={isExporting ? <ActivityIndicator color={Colors.text} /> : <Check size={20} color={Colors.text} />}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: UI.radius.xl,
    borderTopRightRadius: UI.radius.xl,
    height: '80%',
    ...UI.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: UI.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: {
    ...UI.font.title,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollArea: {
    padding: UI.spacing.lg,
  },
  sectionTitle: {
    ...UI.font.smallSemibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: UI.spacing.xl,
  },
  formatCard: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: UI.radius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...UI.shadows.sm,
  },
  formatCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#E8F5E9', 
  },
  formatText: {
    ...UI.font.smallSemibold,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  formatTextActive: {
    color: Colors.primary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: UI.spacing.xl,
  },
  chip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    ...UI.shadows.sm,
  },
  chipActive: {
    backgroundColor: Colors.text,
  },
  chipText: {
    ...UI.font.bodySemibold,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  footer: {
    padding: UI.spacing.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
