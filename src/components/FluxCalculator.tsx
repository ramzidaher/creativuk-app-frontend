import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CalculatorInputs {
  annualGeneration: number;
  currentTariff: string;
  offPeakRate: number;
  peakRate: number;
  currentUsage: number;
  exportRate: number;
}

interface CalculatorResults {
  annualSavings: number;
  monthlySavings: number;
  paybackPeriod: number;
  totalGeneration: number;
  selfConsumption: number;
  exportEarnings: number;
}

export default function FluxCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    annualGeneration: 4000,
    currentTariff: 'Octopus Energy',
    offPeakRate: 0.15,
    peakRate: 0.25,
    currentUsage: 3500,
    exportRate: 0.15,
  });

  const [results, setResults] = useState<CalculatorResults | null>(null);
  const [loading, setLoading] = useState(false);

  const tariffOptions = [
    { name: 'Octopus Energy', offPeak: 0.15, peak: 0.25 },
    { name: 'British Gas', offPeak: 0.18, peak: 0.28 },
    { name: 'EDF Energy', offPeak: 0.16, peak: 0.26 },
    { name: 'E.ON', offPeak: 0.17, peak: 0.27 },
  ];

  const calculateSavings = () => {
    setLoading(true);
    
    // Simulate calculation delay
    setTimeout(() => {
      const selectedTariff = tariffOptions.find(t => t.name === inputs.currentTariff);
      if (!selectedTariff) return;

      // Calculate savings
      const currentAnnualCost = inputs.currentUsage * selectedTariff.peak;
      const solarGeneration = inputs.annualGeneration;
      const selfConsumption = Math.min(solarGeneration, inputs.currentUsage);
      const exportAmount = Math.max(0, solarGeneration - inputs.currentUsage);
      
      const savingsFromSelfConsumption = selfConsumption * selectedTariff.peak;
      const earningsFromExport = exportAmount * inputs.exportRate;
      const totalSavings = savingsFromSelfConsumption + earningsFromExport;
      
      const results: CalculatorResults = {
        annualSavings: totalSavings,
        monthlySavings: totalSavings / 12,
        paybackPeriod: 15000 / totalSavings, // Assuming £15k system cost
        totalGeneration: solarGeneration,
        selfConsumption: selfConsumption,
        exportEarnings: earningsFromExport,
      };

      setResults(results);
      setLoading(false);
    }, 1000);
  };

  const handleInputChange = (field: keyof CalculatorInputs, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleTariffChange = (tariffName: string) => {
    const tariff = tariffOptions.find(t => t.name === tariffName);
    if (tariff) {
      setInputs(prev => ({
        ...prev,
        currentTariff: tariffName,
        offPeakRate: tariff.offPeak,
        peakRate: tariff.peak,
      }));
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Flux Calculator</Text>
        <Text style={styles.subtitle}>
          Calculate your solar energy savings and tariff information
        </Text>
      </View>

      {/* Input Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Configuration</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Annual Generation (kWh)</Text>
          <TextInput
            style={styles.input}
            value={inputs.annualGeneration.toString()}
            onChangeText={(value) => handleInputChange('annualGeneration', value)}
            keyboardType="numeric"
            placeholder="4000"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Current Usage (kWh)</Text>
          <TextInput
            style={styles.input}
            value={inputs.currentUsage.toString()}
            onChangeText={(value) => handleInputChange('currentUsage', value)}
            keyboardType="numeric"
            placeholder="3500"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Energy Provider</Text>
          <View style={styles.tariffContainer}>
            {tariffOptions.map((tariff) => (
              <TouchableOpacity
                key={tariff.name}
                style={[
                  styles.tariffOption,
                  inputs.currentTariff === tariff.name && styles.selectedTariff,
                ]}
                onPress={() => handleTariffChange(tariff.name)}
              >
                <Text style={[
                  styles.tariffText,
                  inputs.currentTariff === tariff.name && styles.selectedTariffText,
                ]}>
                  {tariff.name}
                </Text>
                <Text style={styles.tariffRates}>
                  {tariff.peak}p/kWh peak
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Export Rate (p/kWh)</Text>
          <TextInput
            style={styles.input}
            value={inputs.exportRate.toString()}
            onChangeText={(value) => handleInputChange('exportRate', value)}
            keyboardType="numeric"
            placeholder="0.15"
          />
        </View>

        <TouchableOpacity
          style={styles.calculateButton}
          onPress={calculateSavings}
          disabled={loading}
        >
          <LinearGradient
            colors={['#B4F35B', '#8BC34A']}
            style={styles.calculateGradient}
          >
            <Text style={styles.calculateButtonText}>
              {loading ? 'Calculating...' : 'Calculate Savings'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Results Section */}
      {results && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Savings Results</Text>
          
          <View style={styles.resultsGrid}>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Annual Savings</Text>
              <Text style={styles.resultValue}>£{results.annualSavings.toFixed(0)}</Text>
            </View>
            
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Monthly Savings</Text>
              <Text style={styles.resultValue}>£{results.monthlySavings.toFixed(0)}</Text>
            </View>
            
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Payback Period</Text>
              <Text style={styles.resultValue}>{results.paybackPeriod.toFixed(1)} years</Text>
            </View>
            
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Total Generation</Text>
              <Text style={styles.resultValue}>{results.totalGeneration.toFixed(0)} kWh</Text>
            </View>
          </View>

          <View style={styles.detailedResults}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Self Consumption:</Text>
              <Text style={styles.detailValue}>{results.selfConsumption.toFixed(0)} kWh</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Export Earnings:</Text>
              <Text style={styles.detailValue}>£{results.exportEarnings.toFixed(0)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Peak Rate:</Text>
              <Text style={styles.detailValue}>{inputs.peakRate * 100}p/kWh</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Off-Peak Rate:</Text>
              <Text style={styles.detailValue}>{inputs.offPeakRate * 100}p/kWh</Text>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Export', 'Export calculation to PDF')}
        >
          <Text style={styles.actionButtonText}>Export Results</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Save', 'Save calculation to project')}
        >
          <Text style={styles.actionButtonText}>Save to Project</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  tariffContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tariffOption: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  selectedTariff: {
    backgroundColor: '#B4F35B',
    borderColor: '#B4F35B',
  },
  tariffText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  selectedTariffText: {
    color: '#1e293b',
  },
  tariffRates: {
    fontSize: 12,
    color: '#64748b',
  },
  calculateButton: {
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  calculateGradient: {
    padding: 16,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  resultCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B4F35B',
  },
  detailedResults: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  actionSection: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 