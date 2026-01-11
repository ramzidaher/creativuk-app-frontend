import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SurveyQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'photo' | 'number';
  options?: string[];
  required: boolean;
}

interface SurveyStep {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  passPercentage: number;
}

interface JotFormSurveyProps {
  opportunityId: string;
  onComplete: (surveyData: any) => void;
  onCancel: () => void;
}

export default function JotFormSurvey({ opportunityId, onComplete, onCancel }: JotFormSurveyProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const surveySteps: SurveyStep[] = [
    {
      id: 'basic-eligibility',
      title: 'Basic Eligibility Check',
      description: 'First part - 25% pass for basic eligibility',
      passPercentage: 25,
      questions: [
        {
          id: 'property-type',
          question: 'What type of property do you own?',
          type: 'select',
          options: ['Detached House', 'Semi-Detached', 'Terraced', 'Apartment', 'Other'],
          required: true,
        },
        {
          id: 'roof-age',
          question: 'How old is your roof?',
          type: 'select',
          options: ['Less than 10 years', '10-20 years', '20-30 years', 'Over 30 years'],
          required: true,
        },
        {
          id: 'ownership',
          question: 'Do you own the property?',
          type: 'select',
          options: ['Yes, I own it', 'No, I rent', 'Shared ownership'],
          required: true,
        },
        {
          id: 'energy-bills',
          question: 'What is your average monthly energy bill?',
          type: 'select',
          options: ['Under £50', '£50-£100', '£100-£150', 'Over £150'],
          required: true,
        },
      ],
    },
    {
      id: 'photo-assessment',
      title: 'Photo Assessment',
      description: 'Second part - 50% pass based on photos',
      passPercentage: 50,
      questions: [
        {
          id: 'roof-photos',
          question: 'Please take photos of your roof from different angles',
          type: 'photo',
          required: true,
        },
        {
          id: 'shading-assessment',
          question: 'Are there any trees or buildings that shade your roof?',
          type: 'select',
          options: ['No shading', 'Light shading', 'Moderate shading', 'Heavy shading'],
          required: true,
        },
        {
          id: 'roof-orientation',
          question: 'What direction does your roof face?',
          type: 'select',
          options: ['South', 'South-East', 'South-West', 'East', 'West', 'North'],
          required: true,
        },
      ],
    },
  ];

  const currentSurveyStep = surveySteps[currentStep];

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handlePhotoCapture = () => {
    // This would integrate with camera functionality
    Alert.alert('Camera', 'Camera functionality would be implemented here');
  };

  const calculateEligibilityScore = () => {
    const totalQuestions = currentSurveyStep.questions.length;
    const answeredQuestions = currentSurveyStep.questions.filter(q => 
      answers[q.id] !== undefined && answers[q.id] !== ''
    ).length;
    
    return (answeredQuestions / totalQuestions) * 100;
  };

  const handleNextStep = () => {
    const score = calculateEligibilityScore();
    const requiredScore = currentSurveyStep.passPercentage;
    
    if (score < requiredScore) {
      Alert.alert(
        'Eligibility Check Failed',
        `You need ${requiredScore}% to pass this step. Current score: ${score.toFixed(1)}%`
      );
      return;
    }

    if (currentStep < surveySteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Survey completed
      const surveyData = {
        opportunityId,
        answers,
        photos,
        eligibilityScore: score,
        completedAt: new Date().toISOString(),
        steps: surveySteps.map((step, index) => ({
          stepId: step.id,
          stepNumber: index + 1,
          title: step.title,
          score: calculateEligibilityScore(),
          passed: calculateEligibilityScore() >= step.passPercentage,
        })),
      };
      
      Alert.alert(
        'Survey Completed!',
        'Congratulations! You have passed the eligibility survey.',
        [
          {
            text: 'Continue to Next Step',
            onPress: () => {
              console.log('🔧 Survey completed, calling onComplete with data:', surveyData);
              onComplete(surveyData);
            },
          },
        ]
      );
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    switch (question.type) {
      case 'select':
        return (
          <View key={question.id} style={styles.questionContainer}>
            <Text style={styles.questionText}>{question.question}</Text>
            {question.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  answers[question.id] === option && styles.selectedOption,
                ]}
                onPress={() => handleAnswer(question.id, option)}
              >
                <Text style={[
                  styles.optionText,
                  answers[question.id] === option && styles.selectedOptionText,
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'photo':
        return (
          <View key={question.id} style={styles.questionContainer}>
            <Text style={styles.questionText}>{question.question}</Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePhotoCapture}
            >
              <Text style={styles.photoButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>
            {photos.length > 0 && (
              <View style={styles.photosContainer}>
                {photos.map((photo, index) => (
                  <Image key={index} source={{ uri: photo }} style={styles.photoThumbnail} />
                ))}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <LinearGradient
          colors={['#B4F35B', '#8BC34A']}
          style={styles.progressBar}
        >
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStep + 1) / surveySteps.length) * 100}%` }
            ]} 
          />
        </LinearGradient>
        <Text style={styles.progressText}>
          Step {currentStep + 1} of {surveySteps.length}
        </Text>
      </View>

      {/* Step Info */}
      <View style={styles.stepInfo}>
        <Text style={styles.stepTitle}>{currentSurveyStep.title}</Text>
        <Text style={styles.stepDescription}>{currentSurveyStep.description}</Text>
        <Text style={styles.passRequirement}>
          Pass requirement: {currentSurveyStep.passPercentage}%
        </Text>
      </View>

      {/* Questions */}
      <View style={styles.questionsContainer}>
        {currentSurveyStep.questions.map(renderQuestion)}
      </View>

      {/* Eligibility Score */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreTitle}>Current Score</Text>
        <Text style={styles.scoreValue}>
          {calculateEligibilityScore().toFixed(1)}%
        </Text>
        <Text style={styles.scoreRequirement}>
          Required: {currentSurveyStep.passPercentage}%
        </Text>
      </View>

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <View style={styles.navButtons}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.primaryButton,
              calculateEligibilityScore() < currentSurveyStep.passPercentage && styles.disabledButton,
            ]}
            onPress={handleNextStep}
            disabled={calculateEligibilityScore() < currentSurveyStep.passPercentage}
          >
            <Text style={styles.primaryButtonText}>
              {currentStep === surveySteps.length - 1 ? 'Complete Survey' : 'Next Step'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  progressHeader: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  stepInfo: {
    padding: 16,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  passRequirement: {
    fontSize: 12,
    color: '#B4F35B',
    fontWeight: '600',
  },
  questionsContainer: {
    padding: 16,
  },
  questionContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  optionButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#B4F35B',
    borderColor: '#B4F35B',
  },
  optionText: {
    fontSize: 14,
    color: '#1e293b',
  },
  selectedOptionText: {
    color: '#1e293b',
    fontWeight: '600',
  },
  photoButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  photosContainer: {
    flexDirection: 'row',
    marginTop: 12,
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  scoreContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  scoreTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#B4F35B',
    marginBottom: 4,
  },
  scoreRequirement: {
    fontSize: 12,
    color: '#64748b',
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  navButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#B4F35B',
    borderColor: '#B4F35B',
  },
  disabledButton: {
    backgroundColor: '#e2e8f0',
    borderColor: '#e2e8f0',
  },
  navButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  primaryButtonText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  navButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
}); 